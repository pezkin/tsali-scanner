import React, { useEffect, useState } from 'react';
import { StatusBar, View, Text, ActivityIndicator } from 'react-native';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import { CameraScreen } from './src/screens/CameraScreen';
import { ModelTestScreen } from './src/screens/ModelTestScreen';
import { ValidationScreen } from './src/screens/ValidationScreen';
import { ModelService } from './src/services/ModelService';

export default function App() {
  const [tfReady, setTfReady] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('camera'); // 'camera', 'test', or 'validation'

  useEffect(() => {
    const initApp = async () => {
      try {
        console.log('🚀 Initializing TensorFlow.js...');
        await tf.setBackend('cpu');
        await tf.ready();
        console.log('✅ TensorFlow.js is ready');
        setTfReady(true);

        // Initialize models
        console.log('🔄 Loading ML models...');
        const service = ModelService.getInstance();
        await service.initialize();
        console.log('✅ Models loaded successfully');
        setModelsLoaded(true);
      } catch (err) {
        console.error('❌ Error initializing app:', err.message);
        setError(err.message);
        setTfReady(true); // Still show the screen even if initialization fails
      }
    };

    initApp();

    return () => {
      // Cleanup
    };
  }, []);

  if (!tfReady || !modelsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={{ fontSize: 16, color: '#333', marginTop: 16 }}>
          {!tfReady ? 'Initializing TensorFlow...' : 'Loading models...'}
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffebee', padding: 20 }}>
        <Text style={{ fontSize: 14, color: '#c62828', textAlign: 'center' }}>
          TensorFlow initialization error: {error}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor="#2196F3" />
      {currentScreen === 'camera' ? (
        <CameraScreen onNavigateToTest={() => setCurrentScreen('test')} />
      ) : currentScreen === 'test' ? (
        <ModelTestScreen
          onNavigateToCamera={() => setCurrentScreen('camera')}
          onNavigateToValidation={() => setCurrentScreen('validation')}
        />
      ) : (
        <ValidationScreen onNavigateBack={() => setCurrentScreen('test')} />
      )}
    </View>
  );
}
