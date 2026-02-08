import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { ValidationService } from '../services/ValidationService';

export const ValidationScreen = ({ onNavigateBack }) => {
  const [mode, setMode] = useState('setSelection'); // 'setSelection', 'setDetails', 'sheetView'
  const [selectedSet, setSelectedSet] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  const availableSets = ValidationService.getAvailableSets();

  const handleSelectSet = async (set) => {
    try {
      setLoading(true);
      setSelectedSet(set);
      const loadedSheets = await ValidationService.loadValidationSet(set.id);
      setSheets(loadedSheets);
      setCurrentSheetIndex(0);
      setMode('setDetails');
    } catch (error) {
      console.error('Error loading set:', error);
      Alert.alert('Error', 'Failed to load validation set: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartValidation = () => {
    setMode('sheetView');
  };

  const processCurrentSheet = async () => {
    if (!sheets[currentSheetIndex]) return;

    const sheet = sheets[currentSheetIndex];
    setLoading(true);

    try {
      console.log(`Processing sheet ${currentSheetIndex + 1}/${sheets.length}...`);
      const predictions = await ValidationService.processSheet(sheet.backgroundUri);
      
      const updatedSheets = [...sheets];
      updatedSheets[currentSheetIndex] = {
        ...sheet,
        predictions,
        loaded: true,
      };
      setSheets(updatedSheets);

      // Calculate running stats
      const stats = ValidationService.calculateStats(updatedSheets);
      setStats(stats);
    } catch (error) {
      console.error('Error processing sheet:', error);
      Alert.alert('Error', 'Failed to process sheet: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const goToNextSheet = () => {
    if (currentSheetIndex < sheets.length - 1) {
      setCurrentSheetIndex(currentSheetIndex + 1);
    }
  };

  const goToPrevSheet = () => {
    if (currentSheetIndex > 0) {
      setCurrentSheetIndex(currentSheetIndex - 1);
    }
  };

  const processAllRemaining = async () => {
    setLoading(true);
    try {
      for (let i = currentSheetIndex; i < sheets.length; i++) {
        if (sheets[i].loaded) continue;
        
        const predictions = await ValidationService.processSheet(sheets[i].backgroundUri);
        const updatedSheets = [...sheets];
        updatedSheets[i] = {
          ...sheets[i],
          predictions,
          loaded: true,
        };
        setSheets(updatedSheets);

        // Update stats
        const stats = ValidationService.calculateStats(updatedSheets);
        setStats(stats);
      }
      Alert.alert('Success', 'All sheets processed!');
    } catch (error) {
      console.error('Error processing sheets:', error);
      Alert.alert('Error', 'Failed to process sheets: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Set Selection Mode
  if (mode === 'setSelection') {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Validation</Text>
          <TouchableOpacity onPress={onNavigateBack}>
            <Text style={styles.linkText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.subtitle}>Select a validation set:</Text>
          
          {availableSets.map((set) => (
            <TouchableOpacity
              key={set.id}
              style={styles.setCard}
              onPress={() => handleSelectSet(set)}
            >
              <Text style={styles.setName}>{set.name}</Text>
              <Text style={styles.setCount}>{set.count} sheets</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    );
  }

  // Set Details Mode
  if (mode === 'setDetails') {
    return (
      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{selectedSet?.name}</Text>
          <TouchableOpacity onPress={() => setMode('setSelection')}>
            <Text style={styles.linkText}>← Back</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Total Sheets:</Text>
            <Text style={styles.infoValue}>{sheets.length}</Text>
          </View>

          {stats && (
            <View style={styles.statsCard}>
              <Text style={styles.statsTitle}>Progress Statistics</Text>
              <Text style={styles.statLine}>
                Processed: {String(stats.processed)}/{String(stats.total)}
              </Text>
              <Text style={styles.statLine}>
                Avg OCR Confidence: {String(stats.avgOcrConfidence)}%
              </Text>
              <Text style={styles.statLine}>
                Avg Key Signature Confidence: {String(stats.avgKeySignatureConfidence)}%
              </Text>
              <Text style={styles.statLine}>
                Avg Digit Confidence: {String(stats.avgDigitConfidence)}%
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.button}
            onPress={handleStartValidation}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Start Validation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={processAllRemaining}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Processing...' : 'Process All'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // Sheet View Mode
  const currentSheet = sheets[currentSheetIndex];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Sheet {String(currentSheetIndex + 1)}/{String(sheets.length)}
        </Text>
        <TouchableOpacity onPress={() => setMode('setDetails')}>
          <Text style={styles.linkText}>← Back</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sheetContainer}>
        {/* Background Image */}
        <View style={styles.imageSection}>
          <Text style={styles.sectionLabel}>Background</Text>
          <Image
            source={{ uri: currentSheet.backgroundUri }}
            style={styles.sheetImage}
            resizeMode="contain"
          />
        </View>

        {/* Overlay Image */}
        <View style={styles.imageSection}>
          <Text style={styles.sectionLabel}>Overlay (Ground Truth)</Text>
          <Image
            source={{ uri: currentSheet.overlayUri }}
            style={styles.sheetImage}
            resizeMode="contain"
          />
        </View>

        {/* Predictions */}
        {currentSheet.predictions && (
          <View style={styles.predictionsSection}>
            <Text style={styles.sectionLabel}>Predictions</Text>

            <View style={styles.predictionCard}>
              <Text style={styles.predictionTitle}>🎵 OCR Model</Text>
              <Text style={styles.predictionText}>
                Class: {String(currentSheet.predictions.ocr.classIndex)}
              </Text>
              <Text style={styles.predictionText}>
                Confidence: {String(currentSheet.predictions.ocr.confidence)}%
              </Text>
            </View>

            <View style={styles.predictionCard}>
              <Text style={styles.predictionTitle}>🎼 Key Signature</Text>
              <Text style={styles.predictionText}>
                Type: {String(currentSheet.predictions.keySignatureC.className)}
              </Text>
              <Text style={styles.predictionText}>
                Confidence: {String(currentSheet.predictions.keySignatureC.confidence)}%
              </Text>
            </View>

            <View style={styles.predictionCard}>
              <Text style={styles.predictionTitle}>🔢 Accidental Count</Text>
              <Text style={styles.predictionText}>
                Count: {String(currentSheet.predictions.keySignatureDigit.count)}
              </Text>
              <Text style={styles.predictionText}>
                Confidence: {String(currentSheet.predictions.keySignatureDigit.confidence)}%
              </Text>
            </View>
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}

        {!currentSheet.predictions && !loading && (
          <TouchableOpacity
            style={styles.processButton}
            onPress={processCurrentSheet}
          >
            <Text style={styles.buttonText}>Process This Sheet</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Navigation */}
      <View style={styles.navContainer}>
        <TouchableOpacity
          style={[styles.navButton, currentSheetIndex === 0 && styles.disabledButton]}
          onPress={goToPrevSheet}
          disabled={currentSheetIndex === 0}
        >
          <Text style={styles.navButtonText}>← Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, currentSheetIndex === sheets.length - 1 && styles.disabledButton]}
          onPress={goToNextSheet}
          disabled={currentSheetIndex === sheets.length - 1}
        >
          <Text style={styles.navButtonText}>Next →</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  linkText: {
    fontSize: 14,
    color: '#fff',
    textDecorationLine: 'underline',
  },
  content: {
    padding: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  setCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  setName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 4,
  },
  setCount: {
    fontSize: 14,
    color: '#666',
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
    marginTop: 8,
  },
  statsCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  statLine: {
    fontSize: 14,
    color: '#666',
    marginBottom: 6,
  },
  button: {
    backgroundColor: '#4caf50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  secondaryButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  sheetContainer: {
    padding: 16,
  },
  imageSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  sheetImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#000',
    borderRadius: 8,
  },
  predictionsSection: {
    marginBottom: 24,
  },
  predictionCard: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  predictionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 6,
  },
  predictionText: {
    fontSize: 13,
    color: '#555',
    marginBottom: 4,
  },
  processButton: {
    backgroundColor: '#4caf50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  navContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  navButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
    opacity: 0.5,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
