/**
 * Enhanced OCR Utilities with Advanced Preprocessing and Confidence Scoring
 * Provides robust text extraction with multiple preprocessing techniques
 */

import Tesseract from 'tesseract.js';
import { toGrayscale, adaptiveThreshold, gaussianBlur } from './imageProcessing.js';

/**
 * Enhanced OCR with multiple preprocessing approaches
 * @param {HTMLCanvasElement|Blob|string} input - Input image
 * @param {Object} options - OCR options
 * @returns {Promise<Object>} OCR result with confidence and alternatives
 */
export const enhancedOCR = async (input, options = {}) => {
  const {
    languages = 'eng',
    psm = Tesseract.PSM.AUTO,
    oem = Tesseract.OEM.LSTM_ONLY,
    useMultiplePreprocessing = true,
    confidenceThreshold = 60,
    enableSpellCheck = true,
    fast = false
  } = options;

  const results = [];
  let bestResult = null;

  try {
    // Convert input to canvas if needed
    let canvas = await inputToCanvas(input);

    // Validate canvas dimensions early to avoid IndexSizeError
    if (!canvas || !canvas.getContext) {
      return { success: false, text: '', confidence: 0, method: 'none', alternatives: [], error: 'Invalid canvas' };
    }
    if ((canvas.width | 0) <= 0 || (canvas.height | 0) <= 0) {
      return { success: false, text: '', confidence: 0, method: 'none', alternatives: [], error: 'Empty canvas' };
    }

    // If fast mode, optionally downscale to speed OCR
    if (fast && canvas.width > 700) {
      const scale = 700 / canvas.width;
      const dw = 700;
      const dh = Math.max(1, Math.round(canvas.height * scale));
      const off = document.createElement('canvas');
      off.width = dw; off.height = dh;
      const octx = off.getContext('2d');
      octx.drawImage(canvas, 0, 0, dw, dh);
      canvas = off;
    }

    const multi = fast ? false : useMultiplePreprocessing;
    const localPsm = fast ? Tesseract.PSM.SINGLE_BLOCK : psm;
    const localEnableSpell = fast ? false : enableSpellCheck;

    if (multi) {
      // Try multiple preprocessing approaches
      const preprocessingMethods = [
        { name: 'original', processor: (c) => c },
        { name: 'enhanced', processor: enhanceForOCR },
        { name: 'adaptive', processor: adaptivePreprocessing },
        { name: 'high_contrast', processor: highContrastPreprocessing },
        { name: 'denoised', processor: denoisedPreprocessing }
      ];

      for (const method of preprocessingMethods) {
        try {
          const processedCanvas = method.processor(canvas);
          const result = await performOCR(processedCanvas, {
            languages,
            psm: localPsm,
            oem,
            method: method.name
          });

          if (result && result.confidence > 0) {
            results.push(result);
          }
        } catch (error) {
          console.warn(`OCR failed with ${method.name} preprocessing:`, error);
        }
      }
    } else {
      // Single, faster preprocessing when in fast mode
      const processedCanvas = fast ? adaptivePreprocessing(canvas) : enhanceForOCR(canvas);
      const result = await performOCR(processedCanvas, { languages, psm: localPsm, oem });
      if (result) results.push(result);
    }

    // Select best result based on confidence and text quality
    bestResult = selectBestResult(results, confidenceThreshold);

    if (bestResult && localEnableSpell) {
      bestResult.text = await spellCheckAndCorrect(bestResult.text);
      bestResult.corrected = true;
    }

    return {
      success: bestResult !== null,
      text: bestResult?.text || '',
      confidence: bestResult?.confidence || 0,
      method: bestResult?.method || 'none',
      alternatives: results.filter(r => r !== bestResult).slice(0, 3),
      metadata: {
        totalAttempts: results.length,
        processingTime: Date.now() - (bestResult?.startTime || Date.now()),
        corrected: bestResult?.corrected || false
      }
    };

  } catch (error) {
    console.error('Enhanced OCR failed:', error);
    return {
      success: false,
      text: '',
      confidence: 0,
      error: error.message,
      alternatives: results
    };
  }
};

/**
 * Convert various input types to canvas
 * @param {HTMLCanvasElement|Blob|string} input - Input image
 * @returns {Promise<HTMLCanvasElement>} Canvas element
 */
const inputToCanvas = async (input) => {
  if (input instanceof HTMLCanvasElement) {
    return input;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (input instanceof Blob) {
    const img = new Image();
    const url = URL.createObjectURL(input);
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve(canvas);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  if (typeof input === 'string') {
    const img = new Image();
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        resolve(canvas);
      };
      img.onerror = reject;
      img.src = input;
    });
  }

  throw new Error('Unsupported input type for OCR');
};

/**
 * Enhanced preprocessing for better OCR accuracy
 * @param {HTMLCanvasElement} canvas - Input canvas
 * @returns {HTMLCanvasElement} Processed canvas
 */
const enhanceForOCR = (canvas) => {
  const { width, height } = canvas;
  if ((width | 0) <= 0 || (height | 0) <= 0) {
    const out = document.createElement('canvas'); out.width = 1; out.height = 1; return out;
  }
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, width, height);

  // Step 1: Convert to grayscale
  const grayData = toGrayscale(imageData);

  // Step 2: Apply slight blur to reduce noise
  const blurredImageData = new ImageData(new Uint8ClampedArray(width * height * 4), width, height);
  for (let i = 0; i < grayData.length; i++) {
    const idx = i * 4;
    blurredImageData.data[idx] = blurredImageData.data[idx + 1] = blurredImageData.data[idx + 2] = grayData[i];
    blurredImageData.data[idx + 3] = 255;
  }
  
  const blurred = gaussianBlur(blurredImageData, 0.5);
  const blurredGray = toGrayscale(blurred);

  // Step 3: Enhance contrast using histogram stretching
  let min = 255, max = 0;
  for (let i = 0; i < blurredGray.length; i++) {
    min = Math.min(min, blurredGray[i]);
    max = Math.max(max, blurredGray[i]);
  }

  const range = Math.max(1, max - min);
  const enhanced = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < blurredGray.length; i++) {
    const stretched = Math.min(255, Math.max(0, Math.round((blurredGray[i] - min) * 255 / range)));
    const idx = i * 4;
    enhanced[idx] = enhanced[idx + 1] = enhanced[idx + 2] = stretched;
    enhanced[idx + 3] = 255;
  }

  // Create output canvas
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext('2d');
  outputCtx.putImageData(new ImageData(enhanced, width, height), 0, 0);

  return outputCanvas;
};

/**
 * Adaptive preprocessing using adaptive thresholding
 * @param {HTMLCanvasElement} canvas - Input canvas
 * @returns {HTMLCanvasElement} Processed canvas
 */
const adaptivePreprocessing = (canvas) => {
  const { width, height } = canvas;
  if ((width | 0) <= 0 || (height | 0) <= 0) {
    const out = document.createElement('canvas'); out.width = 1; out.height = 1; return out;
  }
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, width, height);
  const grayData = toGrayscale(imageData);

  // Apply adaptive thresholding
  const binary = adaptiveThreshold(grayData, width, height, 15, 8);
  
  // Convert to RGBA
  const output = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < binary.length; i++) {
    const idx = i * 4;
    output[idx] = output[idx + 1] = output[idx + 2] = binary[i];
    output[idx + 3] = 255;
  }

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext('2d');
  outputCtx.putImageData(new ImageData(output, width, height), 0, 0);

  return outputCanvas;
};

/**
 * High contrast preprocessing
 * @param {HTMLCanvasElement} canvas - Input canvas
 * @returns {HTMLCanvasElement} Processed canvas
 */
const highContrastPreprocessing = (canvas) => {
  const { width, height } = canvas;
  if ((width | 0) <= 0 || (height | 0) <= 0) {
    const out = document.createElement('canvas'); out.width = 1; out.height = 1; return out;
  }
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;

  // Apply high contrast transformation
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    
    // Sigmoid contrast enhancement
    const normalized = gray / 255;
    const enhanced = 1 / (1 + Math.exp(-12 * (normalized - 0.5)));
    const result = Math.round(enhanced * 255);
    
    data[i] = data[i + 1] = data[i + 2] = result;
  }

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext('2d');
  outputCtx.putImageData(imageData, 0, 0);

  return outputCanvas;
};

/**
 * Denoised preprocessing with morphological operations
 * @param {HTMLCanvasElement} canvas - Input canvas
 * @returns {HTMLCanvasElement} Processed canvas
 */
const denoisedPreprocessing = (canvas) => {
  const { width, height } = canvas;
  if ((width | 0) <= 0 || (height | 0) <= 0) {
    const out = document.createElement('canvas'); out.width = 1; out.height = 1; return out;
  }
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, width, height);

  // Apply Gaussian blur for denoising
  const denoised = gaussianBlur(imageData, 1);
  
  // Convert to grayscale and enhance
  const grayData = toGrayscale(denoised);
  
  // Apply morphological opening (erosion followed by dilation)
  const opened = morphologicalOpening(grayData, width, height, 1);
  
  // Convert back to RGBA
  const output = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < opened.length; i++) {
    const idx = i * 4;
    output[idx] = output[idx + 1] = output[idx + 2] = opened[i];
    output[idx + 3] = 255;
  }

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext('2d');
  outputCtx.putImageData(new ImageData(output, width, height), 0, 0);

  return outputCanvas;
};

/**
 * Morphological opening operation
 * @param {Uint8ClampedArray} data - Grayscale image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} kernelSize - Kernel size
 * @returns {Uint8ClampedArray} Processed data
 */
const morphologicalOpening = (data, width, height, kernelSize) => {
  // Simple implementation - can be enhanced with proper structuring elements
  const eroded = new Uint8ClampedArray(data.length);
  const dilated = new Uint8ClampedArray(data.length);

  // Erosion
  for (let y = kernelSize; y < height - kernelSize; y++) {
    for (let x = kernelSize; x < width - kernelSize; x++) {
      let min = 255;
      for (let dy = -kernelSize; dy <= kernelSize; dy++) {
        for (let dx = -kernelSize; dx <= kernelSize; dx++) {
          min = Math.min(min, data[(y + dy) * width + (x + dx)]);
        }
      }
      eroded[y * width + x] = min;
    }
  }

  // Dilation
  for (let y = kernelSize; y < height - kernelSize; y++) {
    for (let x = kernelSize; x < width - kernelSize; x++) {
      let max = 0;
      for (let dy = -kernelSize; dy <= kernelSize; dy++) {
        for (let dx = -kernelSize; dx <= kernelSize; dx++) {
          max = Math.max(max, eroded[(y + dy) * width + (x + dx)]);
        }
      }
      dilated[y * width + x] = max;
    }
  }

  return dilated;
};

/**
 * Perform OCR with Tesseract
 * @param {HTMLCanvasElement} canvas - Input canvas
 * @param {Object} options - OCR options
 * @returns {Promise<Object>} OCR result
 */
const performOCR = async (canvas, options = {}) => {
  const { languages = 'eng', psm = Tesseract.PSM.AUTO, oem = Tesseract.OEM.LSTM_ONLY, method = 'default' } = options;
  const startTime = Date.now();

  try {
    if (!canvas || (canvas.width | 0) <= 0 || (canvas.height | 0) <= 0) {
      return null;
    }
    // Convert canvas to blob (fallback to tiny blank PNG if null)
    const blob = await new Promise(resolve => canvas.toBlob(b => resolve(b || new Blob([new Uint8Array([137,80,78,71])], { type: 'image/png' })), 'image/png'));

    // Perform OCR
    const { data } = await Tesseract.recognize(blob, languages, {
      logger: () => {}, // Suppress logs
      tessedit_pageseg_mode: psm,
      tessedit_ocr_engine_mode: oem,
      preserve_interword_spaces: '1',
      tessedit_char_whitelist: '', // Allow all characters
      tessedit_do_invert: '0'
    });

    const { text, confidence, words } = data;

    // Calculate word-level confidence statistics
    const wordConfidences = words.map(word => word.confidence).filter(conf => conf > 0);
    const avgWordConfidence = wordConfidences.length > 0
      ? wordConfidences.reduce((sum, conf) => sum + conf, 0) / wordConfidences.length
      : 0;

    // Calculate text quality metrics
    const textQuality = calculateTextQuality(text, wordConfidences);

    return {
      text: text.trim(),
      confidence: Math.round(confidence),
      avgWordConfidence: Math.round(avgWordConfidence),
      textQuality,
      method,
      startTime,
      processingTime: Date.now() - startTime,
      wordCount: words.length,
      words: words.map(word => ({
        text: word.text,
        confidence: word.confidence,
        bbox: word.bbox
      }))
    };

  } catch (error) {
    console.error(`OCR failed with method ${method}:`, error);
    return null;
  }
};

/**
 * Calculate text quality metrics
 * @param {string} text - Extracted text
 * @param {Array} wordConfidences - Array of word confidence scores
 * @returns {Object} Text quality metrics
 */
const calculateTextQuality = (text, wordConfidences) => {
  if (!text || text.length === 0) {
    return { score: 0, metrics: {} };
  }

  const metrics = {
    length: text.length,
    wordCount: text.split(/\s+/).filter(word => word.length > 0).length,
    avgWordLength: 0,
    alphaRatio: 0,
    digitRatio: 0,
    spaceRatio: 0,
    specialCharRatio: 0,
    confidenceVariance: 0
  };

  // Calculate character type ratios
  let alphaCount = 0, digitCount = 0, spaceCount = 0, specialCount = 0;

  for (const char of text) {
    if (/[a-zA-Z]/.test(char)) alphaCount++;
    else if (/\d/.test(char)) digitCount++;
    else if (/\s/.test(char)) spaceCount++;
    else specialCount++;
  }

  metrics.alphaRatio = alphaCount / text.length;
  metrics.digitRatio = digitCount / text.length;
  metrics.spaceRatio = spaceCount / text.length;
  metrics.specialCharRatio = specialCount / text.length;

  // Calculate average word length
  const words = text.split(/\s+/).filter(word => word.length > 0);
  metrics.avgWordLength = words.length > 0
    ? words.reduce((sum, word) => sum + word.length, 0) / words.length
    : 0;

  // Calculate confidence variance
  if (wordConfidences.length > 1) {
    const mean = wordConfidences.reduce((sum, conf) => sum + conf, 0) / wordConfidences.length;
    const variance = wordConfidences.reduce((sum, conf) => sum + Math.pow(conf - mean, 2), 0) / wordConfidences.length;
    metrics.confidenceVariance = Math.sqrt(variance);
  }

  // Calculate overall quality score
  let score = 0;

  // Prefer text with good alpha ratio (readable text)
  score += Math.min(1, metrics.alphaRatio * 2) * 30;

  // Reasonable word length
  const idealWordLength = 5;
  score += Math.max(0, 1 - Math.abs(metrics.avgWordLength - idealWordLength) / idealWordLength) * 20;

  // Reasonable space ratio
  const idealSpaceRatio = 0.15;
  score += Math.max(0, 1 - Math.abs(metrics.spaceRatio - idealSpaceRatio) / idealSpaceRatio) * 15;

  // Lower confidence variance is better
  score += Math.max(0, 1 - metrics.confidenceVariance / 50) * 20;

  // Text length bonus (longer text is generally more reliable)
  score += Math.min(15, Math.log(metrics.length + 1) * 3);

  return { score: Math.round(score), metrics };
};

/**
 * Select the best OCR result from multiple attempts
 * @param {Array} results - Array of OCR results
 * @param {number} confidenceThreshold - Minimum confidence threshold
 * @returns {Object|null} Best result or null
 */
const selectBestResult = (results, confidenceThreshold) => {
  if (results.length === 0) return null;

  // Filter results by confidence threshold
  const validResults = results.filter(result =>
    result && result.confidence >= confidenceThreshold && result.text.length > 0
  );

  if (validResults.length === 0) {
    // If no results meet threshold, return the best available
    return results.reduce((best, current) =>
      (current && current.confidence > (best?.confidence || 0)) ? current : best
    );
  }

  // Score each result based on multiple factors
  const scoredResults = validResults.map(result => {
    let score = 0;

    // Base confidence score (0-40 points)
    score += (result.confidence / 100) * 40;

    // Text quality score (0-30 points)
    score += (result.textQuality.score / 100) * 30;

    // Word confidence consistency (0-20 points)
    score += (result.avgWordConfidence / 100) * 20;

    // Text length bonus (0-10 points)
    score += Math.min(10, Math.log(result.text.length + 1) * 2);

    return { ...result, totalScore: score };
  });

  // Return result with highest total score
  return scoredResults.reduce((best, current) =>
    current.totalScore > best.totalScore ? current : best
  );
};

/**
 * Basic spell check and correction
 * @param {string} text - Input text
 * @returns {Promise<string>} Corrected text
 */
const spellCheckAndCorrect = async (text) => {
  // Simple corrections for common OCR errors
  const corrections = {
    // Common OCR character substitutions
    '0': 'O', '1': 'I', '5': 'S', '8': 'B',
    'rn': 'm', 'cl': 'd', 'vv': 'w', 'ii': 'n',
    // Common word corrections
    'teh': 'the', 'adn': 'and', 'taht': 'that',
    'wiht': 'with', 'thier': 'their', 'recieve': 'receive'
  };

  let correctedText = text;

  // Apply simple corrections
  for (const [wrong, right] of Object.entries(corrections)) {
    const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
    correctedText = correctedText.replace(regex, right);
  }

  // Clean up multiple spaces
  correctedText = correctedText.replace(/\s+/g, ' ').trim();

  return correctedText;
};

/**
 * Validate OCR result quality
 * @param {Object} result - OCR result
 * @returns {Object} Validation result
 */
export const validateOCRResult = (result) => {
  const validation = {
    isValid: false,
    confidence: result.confidence || 0,
    issues: [],
    suggestions: []
  };

  if (!result || !result.text) {
    validation.issues.push('No text extracted');
    return validation;
  }

  const text = result.text.trim();

  if (text.length === 0) {
    validation.issues.push('Empty text result');
    return validation;
  }

  if (text.length < 3) {
    validation.issues.push('Text too short');
    validation.suggestions.push('Try repositioning the document');
  }

  if (result.confidence < 50) {
    validation.issues.push('Low confidence score');
    validation.suggestions.push('Improve lighting or document clarity');
  }

  const alphaRatio = (text.match(/[a-zA-Z]/g) || []).length / text.length;
  if (alphaRatio < 0.3) {
    validation.issues.push('Low alphabetic character ratio');
    validation.suggestions.push('Ensure document contains readable text');
  }

  // Consider valid if no major issues
  validation.isValid = validation.issues.length === 0 ||
    (validation.issues.length === 1 && result.confidence > 70);

  return validation;
};
