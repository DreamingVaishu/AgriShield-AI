import * as tf from '@tensorflow/tfjs';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const MODEL_INPUT_SIZE = 224;

export async function preprocessImage(imageUri: string): Promise<tf.Tensor3D> {
    try {
        const resizedImage = await manipulateAsync(
            imageUri,
            [{ resize: { width: MODEL_INPUT_SIZE, height: MODEL_INPUT_SIZE } }],
            { compress: 1, format: SaveFormat.JPEG }
        );

        const response = await fetch(resizedImage.uri);
        const imageData = await response.arrayBuffer();
        const imageTensor = await imageToTensor(imageData);

        const normalized = tf.tidy(() => {
            return imageTensor.toFloat().div(tf.scalar(255.0));
        });

        return normalized as tf.Tensor3D;
    } catch (error) {
        console.error('Error preprocessing image:', error);
        throw new Error('Failed to preprocess image');
    }
}

async function imageToTensor(imageData: ArrayBuffer): Promise<tf.Tensor3D> {
    const blob = new Blob([imageData], { type: 'image/jpeg' });
    const imageUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const tensor = tf.browser.fromPixels(img);
            URL.revokeObjectURL(imageUrl);
            resolve(tensor as tf.Tensor3D);
        };
        img.onerror = (error) => {
            URL.revokeObjectURL(imageUrl);
            reject(error);
        };
        img.src = imageUrl;
    });
}

export function addBatchDimension(tensor: tf.Tensor3D): tf.Tensor4D {
    return tf.expandDims(tensor, 0) as tf.Tensor4D;
}

export function disposeTensors(...tensors: tf.Tensor[]): void {
    tensors.forEach(tensor => {
        if (tensor && !tensor.isDisposed) {
            tensor.dispose();
        }
    });
}
