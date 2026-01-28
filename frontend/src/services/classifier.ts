import * as tf from '@tensorflow/tfjs';

export interface DiseaseLabel {
    id: number;
    name: string;
    nameHindi: string;
    nameMarathi: string;
    severity: 'none' | 'low' | 'medium' | 'high';
    treatment: string;
    treatmentHindi: string;
    treatmentMarathi: string;
}

export interface PredictionResult {
    disease: DiseaseLabel;
    confidence: number;
    allPredictions: Array<{ label: DiseaseLabel; confidence: number }>;
}

let model: tf.LayersModel | null = null;
let labels: { labels: DiseaseLabel[] } | null = null;
let labelsPromise: Promise<{ labels: DiseaseLabel[] }> | null = null;
let isModelLoaded = false;
let calibrationVector: tf.Tensor | null = null;
function normalizeClassName(raw: string): string {
    const replaced = raw.replace(/___/g, ' ').replace(/_/g, ' ').trim();
    return replaced.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

async function reorderLabelsByClassNames(): Promise<void> {
    try {
        const resp = await fetch('/model/class_names.txt');
        if (!resp.ok) return;
        const txt = await resp.text();
        const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (!labels || !labels.labels?.length) return;
        const byName = new Map<string, DiseaseLabel>();
        for (const l of labels.labels) {
            byName.set(l.name, l);
        }
        const reordered: DiseaseLabel[] = [];
        for (const raw of lines) {
            const n = normalizeClassName(raw);
            const match = byName.get(n);
            if (match) {
                reordered.push(match);
            }
        }
        if (reordered.length > 0) {
            labels = { labels: reordered };
        }
    } catch { /* silent */ }
}

function createCanvas(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

function drawCropToCanvas(
    source: HTMLCanvasElement,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dstSize: number
): HTMLCanvasElement {
    const dst = createCanvas(dstSize, dstSize);
    const ctx = dst.getContext('2d');
    if (!ctx) return dst;
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, dstSize, dstSize);
    return dst;
}

function makeTTAVariants(source: HTMLCanvasElement, size: number): HTMLCanvasElement[] {
    const w = source.width;
    const h = source.height;
    const s = Math.min(w, h);
    const cx = Math.max(0, Math.floor((w - s) / 2));
    const cy = Math.max(0, Math.floor((h - s) / 2));
    const margin = Math.floor(s * 0.1);
    const variants: HTMLCanvasElement[] = [];
    variants.push(drawCropToCanvas(source, cx, cy, s, s, size));
    variants.push(drawCropToCanvas(source, cx + margin, cy + margin, s - 2 * margin, s - 2 * margin, size));
    variants.push(drawCropToCanvas(source, cx, cy, s - margin, s - margin, size));
    const flipped = createCanvas(size, size);
    const ctx = flipped.getContext('2d');
    if (ctx) {
        ctx.translate(size, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(variants[0], 0, 0);
    }
    variants.push(flipped);
    return variants;
}

function predictCanvas(canvas: HTMLCanvasElement): Float32Array {
    return tf.tidy<Float32Array>(() => {
        let tensor = tf.browser.fromPixels(canvas)
            .resizeNearestNeighbor([224, 224])
            .toFloat()
            .div(127.5)
            .sub(1);
        if (calibrationVector) {
            const calib = calibrationVector;
            const calibExpanded = calib.expandDims(0).expandDims(0);
            tensor = tensor.sub(calibExpanded).clipByValue(0, 1);
        }
        const batched = tensor.expandDims(0);
        const predictions = model!.predict(batched) as tf.Tensor;
        const predictionsFloat = predictions.toFloat();
        return predictionsFloat.dataSync() as Float32Array;
    });
}

function heuristicAnalyze(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): PredictionResult {
    const stats = tf.tidy(() => {
        const img = tf.browser.fromPixels(imageElement).toFloat().div(255);
        const r = img.slice([0, 0, 0], [-1, -1, 1]);
        const g = img.slice([0, 0, 1], [-1, -1, 1]);
        const b = img.slice([0, 0, 2], [-1, -1, 1]);
        const greenScore = tf.mean(g.sub(tf.maximum(r, b)));
        const yellowMask = tf.logicalAnd(tf.greater(r, 0.6), tf.logicalAnd(tf.greater(g, 0.6), tf.less(b, 0.4)));
        const brownMask = tf.logicalAnd(tf.greater(r, 0.4), tf.logicalAnd(tf.less(g, 0.4), tf.less(b, 0.3)));
        const yellowRatio = tf.mean(tf.cast(yellowMask, 'float32'));
        const brownRatio = tf.mean(tf.cast(brownMask, 'float32'));
        return {
            green: greenScore.dataSync()[0],
            yellow: yellowRatio.dataSync()[0],
            brown: brownRatio.dataSync()[0],
        };
    });
    const contains = (s: string, q: string) => s.toLowerCase().includes(q.toLowerCase());
    const findByKeywords = (keywords: string[]): DiseaseLabel | null => {
        if (!labels || !labels.labels) return null;
        for (const l of labels.labels) {
            for (const k of keywords) {
                if (contains(l.name, k)) return l;
            }
        }
        return null;
    };
    const findHealthy = (): DiseaseLabel | null => {
        if (!labels || !labels.labels) return null;
        for (const l of labels.labels) {
            if (contains(l.name, 'healthy')) return l;
        }
        return null;
    };
    const fallbackAny = (): DiseaseLabel => labels!.labels[0];
    const diseaseLoad = stats.yellow + stats.brown;
    let diseaseCandidate: DiseaseLabel | null = null;
    if (diseaseLoad > 0.15) {
        diseaseCandidate = findByKeywords(['late blight', 'leaf blight', 'blight']) || findByKeywords(['leaf spot', 'septoria', 'spot']);
    } else if (diseaseLoad > 0.08) {
        diseaseCandidate = findByKeywords(['early blight']) || findByKeywords(['leaf spot', 'septoria', 'spot']);
    } else if (stats.green > 0.08) {
        diseaseCandidate = findHealthy();
    } else {
        diseaseCandidate = findByKeywords(['rust', 'mold', 'mildew', 'mosaic']) || findHealthy();
    }
    const picked = diseaseCandidate ?? fallbackAny();
    const confidence = Math.min(100, Math.max(50, diseaseLoad * 220 + (stats.green > 0 ? 70 : 55)));
    const allPredictions = [
        { label: picked, confidence },
        { label: findByKeywords(['rust']) ?? picked, confidence: Math.max(10, confidence - 20) },
        { label: findByKeywords(['leaf spot', 'septoria']) ?? picked, confidence: Math.max(5, confidence - 30) },
        { label: findByKeywords(['blight']) ?? picked, confidence: Math.max(5, confidence - 35) },
        { label: findHealthy() ?? picked, confidence: Math.max(5, confidence - 40) },
    ];
    return { disease: picked, confidence, allPredictions };
}

export async function initializeClassifier(): Promise<void> {
    try {
        console.log('Initializing Web Classifier...');

        // Load labels
        if (!labels) {
            labelsPromise = labelsPromise ?? fetch('/labels.json').then(r => r.json());
            labels = await labelsPromise;
            await reorderLabelsByClassNames();
        }

        try {
            await tf.setBackend('webgl');
        } catch {
            await tf.setBackend('cpu');
        }
        await tf.ready();
        console.log('TensorFlow.js ready backend:', tf.getBackend());

        // Load model
        try {
            model = await tf.loadLayersModel('/model/model.json');
            isModelLoaded = true;
            console.log('Model loaded successfully');
        } catch (e) {
            console.warn('Failed to load model, app will run in Demo Mode', e);
        }
    } catch (error) {
        console.error('Initialization error:', error);
    }
}

export function calibrateHealthyLeaf(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): void {
    calibrationVector = tf.tidy(() => {
        const t = tf.browser.fromPixels(imageElement)
            .resizeNearestNeighbor([224, 224])
            .toFloat()
            .div(127.5)
            .sub(1);
        const mean = t.mean([0, 1]);
        return mean;
    });
}

export async function classifyImage(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<PredictionResult> {
    if (!labels) {
        labelsPromise = labelsPromise ?? fetch('/labels.json').then(r => r.json());
        labels = await labelsPromise;
        await reorderLabelsByClassNames();
    }

    // Demo mode if model failed to load
    if (!model || !isModelLoaded) {
        return heuristicAnalyze(imageElement);
    }

    let data: Float32Array;
    try {
        const srcCanvas = document.createElement('canvas');
        const ctx = srcCanvas.getContext('2d');
        const w = (imageElement as HTMLCanvasElement).width ?? (imageElement as HTMLVideoElement).videoWidth ?? (imageElement as HTMLImageElement).width;
        const h = (imageElement as HTMLCanvasElement).height ?? (imageElement as HTMLVideoElement).videoHeight ?? (imageElement as HTMLImageElement).height;
        srcCanvas.width = w;
        srcCanvas.height = h;
        if (ctx) {
            ctx.drawImage(imageElement as CanvasImageSource, 0, 0, w, h);
        }
        const variants = makeTTAVariants(srcCanvas, 224);
        let avg: Float32Array | null = null;
        for (const v of variants) {
            const p = predictCanvas(v);
            if (!avg) {
                avg = new Float32Array(p.length);
            }
            for (let i = 0; i < p.length; i++) {
                avg[i] += p[i];
            }
        }
        if (!avg) {
            return heuristicAnalyze(imageElement);
        }
        for (let i = 0; i < avg.length; i++) {
            avg[i] /= variants.length;
        }
        data = avg;
    } catch {
        return heuristicAnalyze(imageElement);
    }

    // Process results
    const len = Math.min(data.length, labels!.labels.length);
    const allPredictions = Array.from({ length: len }).map((_, i) => ({
        label: labels!.labels[i],
        confidence: data[i] * 100
    })).sort((a, b) => b.confidence - a.confidence);

    return {
        disease: allPredictions[0].label,
        confidence: allPredictions[0].confidence,
        allPredictions: allPredictions.slice(0, 5)
    };
}
