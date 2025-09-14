/**
 * Error handling test for the enhanced detection system
 * Tests various edge cases and error conditions
 */

import { detectDocument } from './documentDetection.js';
import { toGrayscale, findContours, cannyEdgeDetection } from './imageProcessing.js';

/**
 * Test error handling with invalid inputs
 */
export const testErrorHandling = () => {
  console.log('🧪 Testing error handling...');
  
  const results = {
    invalidCanvas: false,
    invalidDimensions: false,
    emptyCanvas: false,
    largeCanvas: false,
    invalidImageData: false
  };

  try {
    // Test 1: Invalid canvas
    try {
      const result = detectDocument(null);
      results.invalidCanvas = result === null;
    } catch (e) {
      results.invalidCanvas = true;
    }

    // Test 2: Invalid dimensions
    try {
      const canvas = document.createElement('canvas');
      canvas.width = -1;
      canvas.height = -1;
      const result = detectDocument(canvas);
      results.invalidDimensions = result === null;
    } catch (e) {
      results.invalidDimensions = true;
    }

    // Test 3: Empty canvas
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 0;
      canvas.height = 0;
      const result = detectDocument(canvas);
      results.emptyCanvas = result === null;
    } catch (e) {
      results.emptyCanvas = true;
    }

    // Test 4: Very large canvas (should be rejected)
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 10000;
      canvas.height = 10000;
      const result = detectDocument(canvas);
      results.largeCanvas = result === null;
    } catch (e) {
      results.largeCanvas = true;
    }

    // Test 5: Invalid image data
    try {
      const invalidData = new Uint8ClampedArray(0);
      const result = toGrayscale({ data: invalidData, width: 100, height: 100 });
      results.invalidImageData = result.length === 0;
    } catch (e) {
      results.invalidImageData = true;
    }

    console.log('✅ Error handling test results:', results);
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    return {
      success: passedTests === totalTests,
      passedTests,
      totalTests,
      results
    };

  } catch (error) {
    console.error('❌ Error handling test failed:', error);
    return {
      success: false,
      error: error.message,
      results
    };
  }
};

/**
 * Test with valid small canvas to ensure normal operation still works
 */
export const testValidOperation = () => {
  console.log('🧪 Testing valid operation...');
  
  try {
    // Create a small test canvas
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 150;
    const ctx = canvas.getContext('2d');
    
    // Fill with white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw a simple rectangle (document-like)
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(50, 30, 100, 90);
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 30, 100, 90);
    
    // Test document detection
    const result = detectDocument(canvas, {
      minArea: 100,
      combineResults: false // Use simpler detection for test
    });
    
    console.log('✅ Valid operation test result:', {
      detected: !!result,
      score: result?.score || 0
    });
    
    return {
      success: true,
      detected: !!result,
      result
    };
    
  } catch (error) {
    console.error('❌ Valid operation test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Test array bounds and memory safety
 */
export const testMemorySafety = () => {
  console.log('🧪 Testing memory safety...');
  
  const results = {
    largeArrayCreation: false,
    invalidArrayAccess: false,
    memoryLeak: false
  };
  
  try {
    // Test 1: Large array creation should be prevented
    try {
      const largeData = new Uint8ClampedArray(100000000); // 100MB
      const result = findContours(largeData, 10000, 10000);
      results.largeArrayCreation = result.length === 0; // Should return empty array
    } catch (e) {
      results.largeArrayCreation = true; // Or throw error
    }
    
    // Test 2: Invalid array access should be handled
    try {
      const smallData = new Uint8ClampedArray(100);
      const result = cannyEdgeDetection(smallData, 1000, 1000); // Mismatched dimensions
      results.invalidArrayAccess = result.magnitude.length === 0;
    } catch (e) {
      results.invalidArrayAccess = true;
    }
    
    // Test 3: Memory cleanup (basic test)
    try {
      for (let i = 0; i < 10; i++) {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        detectDocument(canvas);
      }
      results.memoryLeak = true; // If we get here without crashing, it's good
    } catch (e) {
      results.memoryLeak = false;
    }
    
    console.log('✅ Memory safety test results:', results);
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    return {
      success: passedTests === totalTests,
      passedTests,
      totalTests,
      results
    };
    
  } catch (error) {
    console.error('❌ Memory safety test failed:', error);
    return {
      success: false,
      error: error.message,
      results
    };
  }
};

/**
 * Run all error handling tests
 */
export const runAllErrorTests = () => {
  console.log('🚀 Running comprehensive error handling tests...');
  
  const startTime = Date.now();
  
  const testResults = {
    errorHandling: testErrorHandling(),
    validOperation: testValidOperation(),
    memorySafety: testMemorySafety()
  };
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  const allPassed = Object.values(testResults).every(result => result.success);
  const totalPassed = Object.values(testResults).filter(result => result.success).length;
  const totalTests = Object.keys(testResults).length;
  
  console.log('🎯 All error handling tests completed:', {
    totalTime: `${totalTime}ms`,
    success: allPassed,
    passed: `${totalPassed}/${totalTests}`,
    results: testResults
  });
  
  return {
    success: allPassed,
    totalTime,
    passed: totalPassed,
    total: totalTests,
    results: testResults
  };
};

export default {
  testErrorHandling,
  testValidOperation,
  testMemorySafety,
  runAllErrorTests
};
