import { ModelService } from './ModelService';
import { ImageProcessor } from '../utils/ImageProcessor';
import { Asset } from 'expo-asset';

// Import sample sheets for validation (static imports for bundler)
const pages36_bg0 = require('../../assets/examples/36pages/background_000.jpeg');
const pages36_ov0 = require('../../assets/examples/36pages/overlay_000.png');
const pages36_bg1 = require('../../assets/examples/36pages/background_001.jpeg');
const pages36_ov1 = require('../../assets/examples/36pages/overlay_001.png');
const pages36_bg2 = require('../../assets/examples/36pages/background_002.jpeg');
const pages36_ov2 = require('../../assets/examples/36pages/overlay_002.png');

const turkish_bg0 = require('../../assets/examples/turkish_march/background_00.jpeg');
const turkish_ov0 = require('../../assets/examples/turkish_march/overlay_00.png');
const turkish_bg1 = require('../../assets/examples/turkish_march/background_01.jpeg');
const turkish_ov1 = require('../../assets/examples/turkish_march/overlay_01.png');

export class ValidationService {
  // Manual sheet definitions for validation (since dynamic requires don't work in RN)
  static exampleSheets = {
    pages_36: {
      name: '36 Pages Collection',
      count: 3, // Demo with first 3
      sheets: [
        { index: 0, background: pages36_bg0, overlay: pages36_ov0 },
        { index: 1, background: pages36_bg1, overlay: pages36_ov1 },
        { index: 2, background: pages36_bg2, overlay: pages36_ov2 },
      ],
    },
    turkish_march: {
      name: 'Turkish March',
      count: 2,
      sheets: [
        { index: 0, background: turkish_bg0, overlay: turkish_ov0 },
        { index: 1, background: turkish_bg1, overlay: turkish_ov1 },
      ],
    },
  };

  /**
   * Get list of available validation sets
   */
  static getAvailableSets() {
    return Object.entries(ValidationService.exampleSheets).map(([key, value]) => ({
      id: key,
      name: value.name,
      count: value.count,
    }));
  }

  /**
   * Load all sheets from a validation set
   */
  static async loadValidationSet(setId) {
    const setConfig = ValidationService.exampleSheets[setId];
    if (!setConfig) {
      throw new Error(`Unknown validation set: ${setId}`);
    }

    // Load assets and get their URIs
    const sheets = await Promise.all(
      setConfig.sheets.map(async (sheet) => {
        try {
          // Load the assets to get their URIs
          const [backgroundAsset, overlayAsset] = await Promise.all([
            Asset.fromModule(sheet.background).downloadAsync(),
            Asset.fromModule(sheet.overlay).downloadAsync(),
          ]);

          return {
            index: sheet.index,
            backgroundUri: backgroundAsset.localUri || backgroundAsset.uri,
            overlayUri: overlayAsset.localUri || overlayAsset.uri,
            loaded: false,
            predictions: null,
          };
        } catch (error) {
          console.error(`Failed to load sheet ${sheet.index}:`, error);
          return null;
        }
      })
    );

    const validSheets = sheets.filter(s => s !== null);
    console.log(`✅ Loaded ${validSheets.length} sample sheets from ${setConfig.name}`);
    return validSheets;
  }

  /**
   * Process a single validation sheet
   */
  static async processSheet(backgroundUri) {
    try {
      const service = ModelService.getInstance();

      // Process the image for OCR
      const ocrInput = await ImageProcessor.preprocessForOCR(backgroundUri);
      const ocrPredictionsData = await service.predictSymbol(ocrInput);
      const ocrPredictions = Array.from(ocrPredictionsData);
      const ocrClassIndex = ocrPredictions.indexOf(Math.max(...ocrPredictions));
      const ocrMaxValue = Math.max(...ocrPredictions);
      ocrInput.dispose();

      // Process for key signature C
      const keyCSInput = await ImageProcessor.preprocessForKeySignatureC(backgroundUri);
      const keyCSPredictionsData = await service.predictKeySignature(keyCSInput);
      const keyCSPredictions = Array.from(keyCSPredictionsData);
      const keyCSClassIndex = keyCSPredictions.indexOf(Math.max(...keyCSPredictions));
      const keyCSMaxValue = Math.max(...keyCSPredictions);
      keyCSInput.dispose();

      // Process for key signature digit
      const keyDigitInput = await ImageProcessor.preprocessForKeySignatureDigit(backgroundUri);
      const keyDigitPredictionsData = await service.predictDigitCount(keyDigitInput);
      const keyDigitPredictions = Array.from(keyDigitPredictionsData);
      const keyDigitClassIndex = keyDigitPredictions.indexOf(Math.max(...keyDigitPredictions));
      const keyDigitMaxValue = Math.max(...keyDigitPredictions);
      keyDigitInput.dispose();

      return {
        ocr: {
          classIndex: ocrClassIndex,
          confidence: String((ocrMaxValue * 100).toFixed(1)),
          topPredictions: ValidationService._getTopPredictions(ocrPredictions, 3),
        },
        keySignatureC: {
          classIndex: keyCSClassIndex,
          className: ['None', 'Sharps', 'Flats'][keyCSClassIndex] || 'Unknown',
          confidence: String((keyCSMaxValue * 100).toFixed(1)),
        },
        keySignatureDigit: {
          classIndex: keyDigitClassIndex,
          count: keyDigitClassIndex,
          confidence: String((keyDigitMaxValue * 100).toFixed(1)),
        },
      };
    } catch (error) {
      console.error('Error processing validation sheet:', error);
      throw error;
    }
  }

  /**
   * Get top N predictions from output
   */
  static _getTopPredictions(predictions, topN) {
    const indexed = predictions.map((prob, index) => ({ index, prob }));
    indexed.sort((a, b) => b.prob - a.prob);
    return indexed.slice(0, topN).map(item => ({
      class: Number.isInteger(item.index) ? item.index : 'N/A',
      confidence: item.prob != null ? String((item.prob * 100).toFixed(1)) : 'N/A',
    }));
  }

  /**
   * Calculate statistics from validation results
   */
  static calculateStats(results) {
    if (!results || results.length === 0) {
      return null;
    }

    const stats = {
      total: results.length,
      processed: results.filter(r => r.predictions).length,
      avgOcrConfidence: 0,
      avgKeySignatureConfidence: 0,
      avgDigitConfidence: 0,
    };

    const processedResults = results.filter(r => r.predictions);
    if (processedResults.length === 0) {
      return stats;
    }

    stats.avgOcrConfidence = (
      processedResults.reduce((sum, r) => sum + parseFloat(r.predictions.ocr.confidence), 0) /
      processedResults.length
    ).toFixed(1);

    stats.avgKeySignatureConfidence = (
      processedResults.reduce((sum, r) => sum + parseFloat(r.predictions.keySignatureC.confidence), 0) /
      processedResults.length
    ).toFixed(1);

    stats.avgDigitConfidence = (
      processedResults.reduce((sum, r) => sum + parseFloat(r.predictions.keySignatureDigit.confidence), 0) /
      processedResults.length
    ).toFixed(1);

    return stats;
  }
}
