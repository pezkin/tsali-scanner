import * as tf from '@tensorflow/tfjs';

class ModelService {
  static instance = null;
  static models = {
    ocr: require('../../assets/models/ocr_model.json'),
    keySignaturesC: require('../../assets/models/keySignatures_c_model.json'),
    keySignaturesDigit: require('../../assets/models/keySignatures_digit_model.json'),
  };

  constructor() {
    this.ocrModel = null;
    this.keySignaturesCModel = null;
    this.keySignaturesDigitModel = null;
    this.isInitialized = false;
  }

  static getInstance() {
    if (!ModelService.instance) {
      ModelService.instance = new ModelService();
    }
    return ModelService.instance;
  }

  async initialize() {
    if (this.isInitialized) {
      console.log('✅ Models already initialized');
      return true;
    }

    try {
      console.log('🔄 Starting model initialization...');
      await tf.ready();

      // Load OCR Model (24x24 grayscale, 71 symbol classes)
      console.log('📥 Loading OCR model...');
      this.ocrModel = await this._loadEmbeddedModel(ModelService.models.ocr);
      console.log('✅ OCR model loaded');
      console.log('   Input:', this.ocrModel.inputs[0].shape);
      console.log('   Output:', this.ocrModel.outputs[0].shape);

      // Load Key Signatures C model (30x15, 3 classes)
      console.log('📥 Loading Key Signatures C model...');
      this.keySignaturesCModel = await this._loadEmbeddedModel(ModelService.models.keySignaturesC);
      console.log('✅ Key Signatures C model loaded');
      console.log('   Input:', this.keySignaturesCModel.inputs[0].shape);
      console.log('   Output:', this.keySignaturesCModel.outputs[0].shape);

      // Load Key Signatures Digit model (30x27, 11 classes)
      console.log('📥 Loading Key Signatures Digit model...');
      this.keySignaturesDigitModel = await this._loadEmbeddedModel(ModelService.models.keySignaturesDigit);
      console.log('✅ Key Signatures Digit model loaded');
      console.log('   Input:', this.keySignaturesDigitModel.inputs[0].shape);
      console.log('   Output:', this.keySignaturesDigitModel.outputs[0].shape);

      this.isInitialized = true;
      console.log('🎉 All models initialized successfully!');
      return true;
    } catch (error) {
      console.error('❌ Error initializing models:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  async _loadEmbeddedModel(modelJson) {
    const model = await tf.models.modelFromJSON({ modelTopology: modelJson.architecture });
    this._applyEmbeddedWeights(model, modelJson.trainable_params || {});
    return model;
  }

  _applyEmbeddedWeights(model, trainableParams) {
    const layerNames = Object.keys(trainableParams);
    layerNames.forEach((layerName) => {
      let layer = null;
      try {
        layer = model.getLayer(layerName);
      } catch (error) {
        return;
      }

      const currentWeights = layer.getWeights();
      if (!currentWeights.length) {
        return;
      }

      const params = trainableParams[layerName] || {};
      const weightArray = this._decodeFloat32(params.weights || []);
      const biasArray = this._decodeFloat32(params.bias || []);

      const newWeights = [];
      if (currentWeights.length >= 1) {
        newWeights.push(tf.tensor(weightArray, currentWeights[0].shape));
      }
      if (currentWeights.length >= 2) {
        newWeights.push(tf.tensor(biasArray, currentWeights[1].shape));
      }

      if (newWeights.length === currentWeights.length) {
        layer.setWeights(newWeights);
        // Don't manually dispose - TensorFlow manages these internally
      }
    });
  }

  _decodeFloat32(chunks) {
    if (!chunks.length) {
      return new Float32Array(0);
    }

    const arrays = chunks.map((chunk) => {
      const bytes = this._decodeBase64ToBytes(chunk);
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
      return new Float32Array(buffer);
    });

    const totalLength = arrays.reduce((sum, array) => sum + array.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    arrays.forEach((array) => {
      merged.set(array, offset);
      offset += array.length;
    });

    return merged;
  }

  _decodeBase64ToBytes(value) {
    const atobFn = globalThis?.atob || global?.atob;
    if (!atobFn) {
      throw new Error('Base64 decoder not available');
    }

    const binary = atobFn(value);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async predictSymbol(input) {
    if (!this.ocrModel) {
      throw new Error('OCR model not initialized');
    }

    try {
      const prediction = this.ocrModel.predict(input);
      const result = await prediction.data();
      prediction.dispose();
      return result;
    } catch (error) {
      console.error('Error in predictSymbol:', error);
      throw error;
    }
  }

  async predictKeySignature(input) {
    if (!this.keySignaturesCModel) {
      throw new Error('Key Signatures C model not initialized');
    }

    try {
      const prediction = this.keySignaturesCModel.predict(input);
      const result = await prediction.data();
      prediction.dispose();
      return result;
    } catch (error) {
      console.error('Error in predictKeySignature:', error);
      throw error;
    }
  }

  async predictDigitCount(input) {
    if (!this.keySignaturesDigitModel) {
      throw new Error('Key Signatures Digit model not initialized');
    }

    try {
      const prediction = this.keySignaturesDigitModel.predict(input);
      const result = await prediction.data();
      prediction.dispose();
      return result;
    } catch (error) {
      console.error('Error in predictDigitCount:', error);
      throw error;
    }
  }

  dispose() {
    if (this.ocrModel && this.ocrModel.dispose) {
      this.ocrModel.dispose();
      this.ocrModel = null;
    }
    if (this.keySignaturesCModel && this.keySignaturesCModel.dispose) {
      this.keySignaturesCModel.dispose();
      this.keySignaturesCModel = null;
    }
    if (this.keySignaturesDigitModel && this.keySignaturesDigitModel.dispose) {
      this.keySignaturesDigitModel.dispose();
      this.keySignaturesDigitModel = null;
    }
    this.isInitialized = false;
  }
}

export { ModelService };
