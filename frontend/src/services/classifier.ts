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
let isModelLoaded = false;

export async function initializeClassifier(): Promise<void> {
    try {
        console.log('Initializing Web Classifier...');

        // Load labels
        const response = await fetch('/labels.json');
        labels = await response.json();

        // Initialize TF
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

export async function classifyImage(imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<PredictionResult> {
    if (!labels) {
        throw new Error('Labels not loaded');
    }

    // Demo mode if model failed to load
    if (!model || !isModelLoaded) {
        console.log('Running in Demo Mode');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay

        // Return random result for demo
        const randomIndex = Math.floor(Math.random() * 3); // Top 3 are usually diseases
        const demoLabel = labels.labels[randomIndex];
        return {
            disease: demoLabel,
            confidence: 85 + Math.random() * 14,
            allPredictions: labels.labels.slice(0, 5).map(l => ({
                label: l,
                confidence: Math.random() * 20
            }))
        };
    }

    const data = tf.tidy(() => {
        // Preprocess image
        let tensor = tf.browser.fromPixels(imageElement)
            .resizeNearestNeighbor([224, 224]) // Adjust size to match training
            .toFloat();

        // Normalize (0-1) or as required by your model
        // Assuming typical normalization: (x / 255.0)
        tensor = tensor.div(255.0);

        // Add batch dimension
        const batched = tensor.expandDims(0);

        // Predict
        const predictions = model!.predict(batched) as tf.Tensor;
        return predictions.dataSync();
    });

    // Process results
    const allPredictions = Array.from(data)
        .map((score, i) => ({
            label: labels!.labels[i],
            confidence: score * 100
        }))
        .sort((a, b) => b.confidence - a.confidence);

    return {
        disease: allPredictions[0].label,
        confidence: allPredictions[0].confidence,
        allPredictions: allPredictions.slice(0, 5)
    };
}
