/**
 * Test utilities for enhanced object detection and OCR
 * Use this to verify the improvements are working correctly
 */

import { detectDocument } from './documentDetection.js';
import { enhancedOCR, validateOCRResult } from './enhancedOCR.js';
import { cannyEdgeDetection, toGrayscale } from './imageProcessing.js';

/**
 * Test document detection with a sample image
 * @param {HTMLCanvasElement} canvas - Test canvas with document image
 * @returns {Promise<Object>} Test results
 */
export const testDocumentDetection = async (canvas) => {
  console.log('🧪 Testing enhanced document detection...');
  
  const startTime = Date.now();
  
  try {
    // Test with different detection options
    const results = {
      basic: await detectDocument(canvas, { combineResults: false }),
      enhanced: await detectDocument(canvas, { 
        combineResults: true,
        useAdaptiveThreshold: true,
        minArea: 1000
      }),
      strict: await detectDocument(canvas, {
        combineResults: true,
        useAdaptiveThreshold: true,
        minArea: 5000,
        cannyLow: 100,
        cannyHigh: 200
      })
    };

    const processingTime = Date.now() - startTime;

    console.log('✅ Document detection test completed:', {
      processingTime: `${processingTime}ms`,
      basicFound: !!results.basic,
      enhancedFound: !!results.enhanced,
      strictFound: !!results.strict,
      bestScore: Math.max(
        results.basic?.score || 0,
        results.enhanced?.score || 0,
        results.strict?.score || 0
      )
    });

    return {
      success: true,
      results,
      processingTime,
      recommendation: results.enhanced ? 'enhanced' : results.basic ? 'basic' : 'none'
    };

  } catch (error) {
    console.error('❌ Document detection test failed:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime
    };
  }
};

/**
 * Test enhanced OCR with different preprocessing methods
 * @param {HTMLCanvasElement} canvas - Test canvas with text image
 * @returns {Promise<Object>} Test results
 */
export const testEnhancedOCR = async (canvas) => {
  console.log('🧪 Testing enhanced OCR...');
  
  const startTime = Date.now();
  
  try {
    // Test with different OCR configurations
    const results = {
      basic: await enhancedOCR(canvas, { 
        useMultiplePreprocessing: false,
        confidenceThreshold: 50
      }),
      enhanced: await enhancedOCR(canvas, {
        useMultiplePreprocessing: true,
        confidenceThreshold: 30,
        enableSpellCheck: true
      }),
      strict: await enhancedOCR(canvas, {
        useMultiplePreprocessing: true,
        confidenceThreshold: 70,
        enableSpellCheck: true,
        maxRetries: 3
      })
    };

    const processingTime = Date.now() - startTime;

    // Validate results
    const validations = {
      basic: results.basic.success ? validateOCRResult(results.basic) : null,
      enhanced: results.enhanced.success ? validateOCRResult(results.enhanced) : null,
      strict: results.strict.success ? validateOCRResult(results.strict) : null
    };

    console.log('✅ Enhanced OCR test completed:', {
      processingTime: `${processingTime}ms`,
      basicSuccess: results.basic.success,
      enhancedSuccess: results.enhanced.success,
      strictSuccess: results.strict.success,
      bestConfidence: Math.max(
        results.basic.confidence || 0,
        results.enhanced.confidence || 0,
        results.strict.confidence || 0
      ),
      validResults: Object.values(validations).filter(v => v?.isValid).length
    });

    return {
      success: true,
      results,
      validations,
      processingTime,
      recommendation: results.enhanced.success ? 'enhanced' : 
                     results.basic.success ? 'basic' : 
                     results.strict.success ? 'strict' : 'none'
    };

  } catch (error) {
    console.error('❌ Enhanced OCR test failed:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime
    };
  }
};

/**
 * Test image processing utilities
 * @param {HTMLCanvasElement} canvas - Test canvas
 * @returns {Object} Test results
 */
export const testImageProcessing = (canvas) => {
  console.log('🧪 Testing image processing utilities...');
  
  const startTime = Date.now();
  
  try {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Test grayscale conversion
    const grayData = toGrayscale(imageData);
    const graySuccess = grayData.length === canvas.width * canvas.height;
    
    // Test edge detection
    const edges = cannyEdgeDetection(grayData, canvas.width, canvas.height);
    const edgeSuccess = edges.length === grayData.length;
    
    const processingTime = Date.now() - startTime;
    
    console.log('✅ Image processing test completed:', {
      processingTime: `${processingTime}ms`,
      grayscaleSuccess: graySuccess,
      edgeDetectionSuccess: edgeSuccess
    });
    
    return {
      success: graySuccess && edgeSuccess,
      processingTime,
      tests: {
        grayscale: graySuccess,
        edgeDetection: edgeSuccess
      }
    };
    
  } catch (error) {
    console.error('❌ Image processing test failed:', error);
    return {
      success: false,
      error: error.message,
      processingTime: Date.now() - startTime
    };
  }
};

/**
 * Run comprehensive test suite
 * @param {HTMLCanvasElement} canvas - Test canvas with document/text
 * @returns {Promise<Object>} Complete test results
 */
export const runComprehensiveTest = async (canvas) => {
  console.log('🚀 Running comprehensive enhancement test suite...');
  
  const overallStartTime = Date.now();
  
  const results = {
    imageProcessing: testImageProcessing(canvas),
    documentDetection: await testDocumentDetection(canvas),
    enhancedOCR: await testEnhancedOCR(canvas)
  };
  
  const overallTime = Date.now() - overallStartTime;
  
  const successCount = Object.values(results).filter(r => r.success).length;
  const totalTests = Object.keys(results).length;
  
  console.log('🎯 Comprehensive test completed:', {
    overallTime: `${overallTime}ms`,
    successRate: `${successCount}/${totalTests}`,
    allPassed: successCount === totalTests
  });
  
  return {
    success: successCount === totalTests,
    overallTime,
    successRate: successCount / totalTests,
    results,
    summary: {
      imageProcessing: results.imageProcessing.success,
      documentDetection: results.documentDetection.success,
      enhancedOCR: results.enhancedOCR.success
    }
  };
};

/**
 * Create a test canvas with sample content for testing
 * @param {string} type - Type of test content ('document' or 'text')
 * @returns {HTMLCanvasElement} Test canvas
 */
export const createTestCanvas = (type = 'document') => {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');
  
  // Fill with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (type === 'document') {
    // Draw a document-like rectangle
    ctx.fillStyle = '#f8f8f8';
    ctx.fillRect(100, 80, 440, 320);
    
    // Add border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(100, 80, 440, 320);
    
    // Add some text lines
    ctx.fillStyle = '#333333';
    ctx.font = '16px Arial';
    ctx.fillText('Sample Document Text', 120, 120);
    ctx.fillText('This is a test document for', 120, 150);
    ctx.fillText('enhanced OCR processing.', 120, 180);
    ctx.fillText('Multiple lines of text to', 120, 210);
    ctx.fillText('test the accuracy improvements.', 120, 240);
    
  } else if (type === 'text') {
    // Just add text for OCR testing
    ctx.fillStyle = '#000000';
    ctx.font = '24px Arial';
    ctx.fillText('Enhanced OCR Test', 200, 200);
    ctx.font = '18px Arial';
    ctx.fillText('Testing improved accuracy', 180, 240);
    ctx.fillText('with multiple preprocessing', 170, 270);
    ctx.fillText('methods and validation.', 190, 300);
  }
  
  return canvas;
};

// Export test utilities
export default {
  testDocumentDetection,
  testEnhancedOCR,
  testImageProcessing,
  runComprehensiveTest,
  createTestCanvas
};
