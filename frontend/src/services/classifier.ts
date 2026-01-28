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
    const pick = (name: string) => labels!.labels.find(l => l.name === name) ?? labels!.labels[0];
    const diseaseCandidate = (() => {
        const diseaseLoad = stats.yellow + stats.brown;
        if (diseaseLoad > 0.12) return pick('Tomato Late Blight');
        if (diseaseLoad > 0.06) return pick('Tomato Early Blight');
        if (stats.green > 0.06) return pick('Tomato Healthy');
        return pick('Tomato Leaf Mold');
    })();
    const confidence = Math.min(100, Math.max(50, (stats.yellow + stats.brown) * 200 + (stats.green > 0 ? 70 : 60)));
    const allPredictions = [
        { label: diseaseCandidate, confidence },
        { label: pick('Tomato Leaf Mold'), confidence: Math.max(10, confidence - 20) },
        { label: pick('Tomato Septoria Leaf Spot'), confidence: Math.max(5, confidence - 30) },
        { label: pick('Tomato Early Blight'), confidence: Math.max(5, confidence - 35) },
        { label: pick('Tomato Healthy'), confidence: Math.max(5, confidence - 40) },
    ];
    return { disease: diseaseCandidate, confidence, allPredictions };
}

export async function initializeClassifier(): Promise<void> {
    try {
        console.log('Initializing Web Classifier...');

        // Load labels
        if (!labels) {
            labelsPromise = labelsPromise ?? fetch('/labels.json').then(r => r.json());
            labels = await labelsPromise;
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
    }

    // Demo mode if model failed to load
    if (!model || !isModelLoaded) {
        return heuristicAnalyze(imageElement);
    }

    let data: Float32Array | number[];
    try {
        data = tf.tidy<Float32Array>(() => {
            let tensor = tf.browser.fromPixels(imageElement)
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
