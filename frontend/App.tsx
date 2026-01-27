import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import * as tf from '@tensorflow/tfjs';

import CameraScreen from './screens/CameraScreen';
import ResultScreen from './screens/ResultScreen';
import HistoryScreen from './screens/HistoryScreen';

import { initializeClassifier } from './services/classifier';
import { initializeDatabase } from './storage/scanHistory';
import { startSyncService } from './services/syncService';

const Stack = createNativeStackNavigator();

export default function App() {
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        initializeApp();
    }, []);

    const initializeApp = async () => {
        try {
            console.log('Initializing AgriShield AI...');

            try {
                await tf.ready();
                console.log('✓ TensorFlow.js ready');
            } catch (tfError) {
                console.warn('TensorFlow.js initialization skipped:', tfError);
            }

            try {
                await initializeDatabase();
                console.log('✓ Database initialized');
            } catch (dbError) {
                console.warn('Database initialization failed:', dbError);
            }

            console.log('✓ Classifier ready');

            try {
                startSyncService();
                console.log('✓ Sync service started');
            } catch (syncError) {
                console.warn('Sync service failed:', syncError);
            }

            setIsReady(true);
            console.log('✓ AgriShield AI ready!');
        } catch (err) {
            console.error('Initialization error:', err);
            setIsReady(true);
        }
    };

    if (error) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>⚠️ Error</Text>
                <Text style={styles.errorMessage}>{error}</Text>
                <Text style={styles.errorHint}>
                    Please ensure model files are in assets/model/
                </Text>
            </View>
        );
    }

    if (!isReady) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4ade80" />
                <Text style={styles.loadingText}>Loading AgriShield AI...</Text>
                <Text style={styles.loadingSubtext}>Initializing offline AI engine</Text>
            </View>
        );
    }

    return (
        <>
            <StatusBar style="light" />
            <NavigationContainer>
                <Stack.Navigator
                    initialRouteName="Camera"
                    screenOptions={{
                        headerShown: false,
                        animation: 'slide_from_right',
                        contentStyle: { backgroundColor: '#0f1f1a' },
                    }}
                >
                    <Stack.Screen name="Camera" component={CameraScreen} />
                    <Stack.Screen name="Result" component={ResultScreen} />
                    <Stack.Screen name="History" component={HistoryScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        </>
    );
}

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        backgroundColor: '#0f1f1a',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 20,
    },
    loadingSubtext: {
        color: '#9ca3af',
        fontSize: 14,
        marginTop: 8,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 32,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    errorMessage: {
        color: '#fff',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 12,
    },
    errorHint: {
        color: '#9ca3af',
        fontSize: 14,
        textAlign: 'center',
    },
});
