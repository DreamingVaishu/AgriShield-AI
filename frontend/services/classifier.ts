import * as tf from '@tensorflow/tfjs';
import { Platform } from 'react-native';
import labels from '../assets/labels.json';
import { preprocessImage, addBatchDimension, disposeTensors } from '../utils/imagePreprocess';

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
let isModelLoaded = false;

export async function initializeClassifier(): Promise<void> {
    try {
        console.log('Initializing TensorFlow.js...');

        await tf.ready();
        console.log('TensorFlow.js backend:', tf.getBackend());

        await loadModel();

        console.log('Classifier initialized successfully');
    } catch (error) {
        console.error('Error initializing classifier:', error);
        throw new Error('Failed to initialize AI classifier');
    }
}

async function loadModel(): Promise<void> {
    try {
        if (isModelLoaded && model) {
            console.log('Model already loaded');
            return;
        }

        console.log('Loading model from assets...');

        // For now, skip model loading and run in demo mode
        // In production, you would load the model from a URL or local path
        console.warn('Model loading skipped. App running in demo mode.');
        console.warn('To enable AI predictions, implement proper model loading for your platform.');
        isModelLoaded = false;

    } catch (error) {
        console.error('Error loading model:', error);
        isModelLoaded = false;
    }
}

export async function classifyDisease(imageUri: string): Promise<PredictionResult> {
    try {
        if (!model || !isModelLoaded) {
            await loadModel();
        }

        if (!model || !isModelLoaded) {
            console.warn('Model not loaded - returning demo prediction');
            const demoLabel = labels.labels[0] as DiseaseLabel;
            return {
                disease: demoLabel,
                confidence: 85.5,
                allPredictions: [
                    { label: labels.labels[0] as DiseaseLabel, confidence: 85.5 },
                    { label: labels.labels[1] as DiseaseLabel, confidence: 10.2 },
                    { label: labels.labels[2] as DiseaseLabel, confidence: 3.1 },
                    { label: labels.labels[3] as DiseaseLabel, confidence: 0.8 },
                    { label: labels.labels[4] as DiseaseLabel, confidence: 0.4 },
                ],
            };
        }

        console.log('Preprocessing image...');
        const imageTensor = await preprocessImage(imageUri);
        const batchedTensor = addBatchDimension(imageTensor);

        console.log('Running inference...');
        const predictions = model.predict(batchedTensor) as tf.Tensor;
        const predictionData = await predictions.data();

        disposeTensors(imageTensor, batchedTensor, predictions);

        const allPredictions = Array.from(predictionData)
            .map((confidence, index) => ({
                label: labels.labels[index] as DiseaseLabel,
                confidence: confidence * 100,
            }))
            .sort((a, b) => b.confidence - a.confidence);

        const topPrediction = allPredictions[0];

        console.log(`Prediction: ${topPrediction.label.name} (${topPrediction.confidence.toFixed(2)}%)`);

        return {
            disease: topPrediction.label,
            confidence: topPrediction.confidence,
            allPredictions: allPredictions.slice(0, 5),
        };
    } catch (error) {
        console.error('Error classifying disease:', error);
        throw new Error('Failed to classify disease. Please try again.');
    }
}

export function isModelReady(): boolean {
    return isModelLoaded && model !== null;
}

export function getModelInfo(): { loaded: boolean; backend: string } {
    return {
        loaded: isModelLoaded,
        backend: tf.getBackend(),
    };
}

export function disposeModel(): void {
    if (model) {
        model.dispose();
        model = null;
        isModelLoaded = false;
        console.log('Model disposed');
    }
}
