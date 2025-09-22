/**
 * Enhanced Document Detection Utilities
 * Combines multiple detection approaches for robust document boundary detection
 */

import {
  toGrayscale,
  cannyEdgeDetection,
  findContours,
  findDocumentBoundary,
  adaptiveThreshold,
  gaussianBlur
} from './imageProcessing.js';


// Reusable offscreen canvas to avoid frequent allocations in fast path
let __docDetectScratchCanvas = null;

/**
 * Enhanced document detection using multiple approaches
 * @param {HTMLCanvasElement} canvas - Input canvas with image
 * @param {Object} options - Detection options
 * @returns {Object|null} Document boundary information
 */
export const detectDocument = (canvas, options = {}) => {
  const {
    minArea = 1000,
    cannyLow = 50,
    cannyHigh = 150,
    useAdaptiveThreshold = true,
    combineResults = true,
    fast = false
  } = options;

  // Validate canvas
  if (!canvas || !canvas.getContext) {
    console.warn('Invalid canvas provided to detectDocument');
    return null;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn('Could not get 2D context from canvas');
    return null;
  }

  const { width, height } = canvas;

  // Validate dimensions
  if (width <= 0 || height <= 0 || width > 4000 || height > 4000) {
    console.warn('Invalid canvas dimensions:', { width, height });
    return null;
  }

  try {
    const imageData = ctx.getImageData(0, 0, width, height);

    // Convert to grayscale with validation
    const grayData = toGrayscale(imageData);
    if (!grayData || grayData.length !== width * height) {
      console.warn('Failed to convert image to grayscale');
      return null;
    }

    // Fast path: downscaled quick detection for responsive hover feedback
    if (fast) {
      try {
        const targetW = 320;
        const scale = Math.min(1, targetW / width);
        let sw = width, sh = height;
        let smallGray = grayData;

        if (scale < 1) {
          const dw = Math.max(1, Math.round(width * scale));
          const dh = Math.max(1, Math.round(height * scale));
          if (!__docDetectScratchCanvas) __docDetectScratchCanvas = document.createElement('canvas');
          __docDetectScratchCanvas.width = dw; __docDetectScratchCanvas.height = dh;
          const octx = __docDetectScratchCanvas.getContext('2d');
          octx.drawImage(canvas, 0, 0, dw, dh);
          const smallImage = octx.getImageData(0, 0, dw, dh);
          smallGray = toGrayscale(smallImage);
          sw = dw; sh = dh;
        }

        // Quick Canny + contours
        const edges = cannyEdgeDetection(smallGray, sw, sh, cannyLow, cannyHigh);
        let contours = [];
        try { contours = findContours(edges, sw, sh); } catch { /* no-op */ }
        let doc = null;
        try { doc = findDocumentBoundary(contours, Math.max(100, Math.round(minArea * scale * scale))); } catch { /* no-op */ }

        if (!doc) {
          // Fallback to enhanced edge projection on downscaled data
          doc = enhancedEdgeDetection(smallGray, sw, sh, Math.max(100, Math.round(minArea * scale * scale)));
        }

        if (!doc) return null;
        const bb = doc.boundingBox;
        const inv = scale === 0 ? 1 : (1 / scale);

        const mapped = {
          ...doc,
          boundingBox: {
            x: Math.max(0, Math.round(bb.x * inv)),
            y: Math.max(0, Math.round(bb.y * inv)),
            width: Math.min(width, Math.round(bb.width * inv)),
            height: Math.min(height, Math.round(bb.height * inv))
          },
          contour: Array.isArray(doc.contour)
            ? doc.contour.map(p => ({ x: Math.round(p.x * inv), y: Math.round(p.y * inv) }))
            : undefined,
          score: Math.min(1, (doc.score || 0.5) + 0.05) // small boost for responsiveness
        };
        return mapped;
      } catch (e) {
        console.warn('Fast document detection failed, falling back:', e);
        // Continue to full detection below
      }
    }

    const results = [];

    // Method 1: Canny edge detection + contour finding
    const cannyEdges = cannyEdgeDetection(grayData, width, height, cannyLow, cannyHigh);
    const cannyContours = findContours(cannyEdges, width, height);
    const cannyDoc = findDocumentBoundary(cannyContours, minArea);

    if (cannyDoc) {
      results.push({
        method: 'canny',
        confidence: cannyDoc.score,
        boundary: cannyDoc,
        weight: 1.0
      });
    }

    // Method 2: Adaptive threshold + contour finding
    if (useAdaptiveThreshold) {
      const adaptiveBinary = adaptiveThreshold(grayData, width, height, 15, 10);
      const adaptiveContours = findContours(adaptiveBinary, width, height);
      const adaptiveDoc = findDocumentBoundary(adaptiveContours, minArea);

      if (adaptiveDoc) {
        results.push({
          method: 'adaptive',
          confidence: adaptiveDoc.score,
          boundary: adaptiveDoc,
          weight: 0.8
        });
      }
    }

    // Method 3: Enhanced edge-based detection (original method improved)
    const edgeDoc = enhancedEdgeDetection(grayData, width, height, minArea);
    if (edgeDoc) {
      results.push({
        method: 'edge',
        confidence: edgeDoc.score,
        boundary: edgeDoc,
        weight: 0.6
      });
    }

    // Method 4: Gradient-based detection
    const gradientDoc = gradientBasedDetection(grayData, width, height, minArea);
    if (gradientDoc) {
      results.push({
        method: 'gradient',
        confidence: gradientDoc.score,
        boundary: gradientDoc,
        weight: 0.7
      });
    }

    if (results.length === 0) return null;

    // Combine results or return best single result
    if (combineResults && results.length > 1) {
      return combineDetectionResults(results);
    } else {
      // Return result with highest weighted confidence
      const best = results.reduce((a, b) =>
        (a.confidence * a.weight) > (b.confidence * b.weight) ? a : b
      );
      return best.boundary;
    }
  } catch (error) {
    console.error('Error in document detection:', error);
    return null;
  }
};

/**
 * Enhanced edge-based detection (improved version of original)
 * @param {Uint8ClampedArray} grayData - Grayscale image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} minArea - Minimum area threshold
 * @returns {Object|null} Document boundary
 */
const enhancedEdgeDetection = (grayData, width, height, minArea) => {
  try {
    // Validate inputs
    if (!grayData || width <= 0 || height <= 0 || grayData.length !== width * height) {
      console.warn('Invalid parameters for enhancedEdgeDetection');
      return null;
    }

    // Apply Gaussian blur to reduce noise
    const totalPixels = width * height;
    const imageDataArray = new Uint8ClampedArray(totalPixels * 4);

    for (let i = 0; i < grayData.length && i < totalPixels; i++) {
      const idx = i * 4;
      const grayValue = Math.max(0, Math.min(255, grayData[i]));
      imageDataArray[idx] = imageDataArray[idx + 1] = imageDataArray[idx + 2] = grayValue;
      imageDataArray[idx + 3] = 255;
    }

    const imageData = new ImageData(imageDataArray, width, height);

    const blurred = gaussianBlur(imageData, 1);
    const blurredGray = toGrayscale(blurred);

    // Enhanced Sobel edge detection
    const mag = new Float32Array(totalPixels);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        // 3x3 Sobel kernels
        const gx =
          -1 * blurredGray[(y-1)*width + (x-1)] + 1 * blurredGray[(y-1)*width + (x+1)] +
          -2 * blurredGray[y*width + (x-1)]     + 2 * blurredGray[y*width + (x+1)] +
          -1 * blurredGray[(y+1)*width + (x-1)] + 1 * blurredGray[(y+1)*width + (x+1)];

        const gy =
          -1 * blurredGray[(y-1)*width + (x-1)] - 2 * blurredGray[(y-1)*width + x] - 1 * blurredGray[(y-1)*width + (x+1)] +
           1 * blurredGray[(y+1)*width + (x-1)] + 2 * blurredGray[(y+1)*width + x] + 1 * blurredGray[(y+1)*width + (x+1)];

        mag[y * width + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    // Dynamic thresholding
    let sum = 0;
    for (let i = 0; i < mag.length; i++) sum += mag[i];
    const mean = sum / mag.length;
    const thresh = Math.max(30, mean * 1.2);

    // Find edge projections with validation
    if (width <= 0 || height <= 0 || width > 10000 || height > 10000) {
      console.warn('Invalid dimensions for projection arrays:', { width, height });
      return null;
    }

    const colCounts = new Uint32Array(width);
    const rowCounts = new Uint32Array(height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (mag[y * width + x] >= thresh) {
          colCounts[x]++;
          rowCounts[y]++;
        }
      }
    }

    // Find document boundaries using improved peak detection
    const xBounds = findPeakBounds(colCounts, width * 0.1);
    const yBounds = findPeakBounds(rowCounts, height * 0.1);

    if (!xBounds || !yBounds) return null;

    const docWidth = xBounds.end - xBounds.start;
    const docHeight = yBounds.end - yBounds.start;
    const area = docWidth * docHeight;

    if (area < minArea) return null;

    // Calculate confidence based on edge density and aspect ratio
    const edgeDensity = (xBounds.strength + yBounds.strength) / (docWidth + docHeight);
    const aspectRatio = Math.max(docWidth, docHeight) / Math.min(docWidth, docHeight);
    const aspectScore = Math.max(0, 1 - Math.abs(aspectRatio - 1.414) / 2); // Prefer A4-like ratios

    const confidence = edgeDensity * aspectScore * Math.sqrt(area / (width * height));

    return {
      contour: [
        { x: xBounds.start, y: yBounds.start },
        { x: xBounds.end, y: yBounds.start },
        { x: xBounds.end, y: yBounds.end },
        { x: xBounds.start, y: yBounds.end }
      ],
      area,
      score: confidence,
      boundingBox: {
        x: xBounds.start,
        y: yBounds.start,
        width: docWidth,
        height: docHeight
      }
    };

  } catch (error) {
    console.error('Enhanced edge detection failed:', error);
    return null;
  }
};

/**
 * Find peak bounds in projection array
 * @param {Uint32Array} projection - Projection array
 * @param {number} minStrength - Minimum strength threshold
 * @returns {Object|null} Bounds with start, end, and strength
 */
const findPeakBounds = (projection, minStrength) => {
  const len = projection.length;
  const smoothed = new Float32Array(len);

  // Apply smoothing
  for (let i = 0; i < len; i++) {
    let sum = 0, count = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(len - 1, i + 2); j++) {
      sum += projection[j];
      count++;
    }
    smoothed[i] = sum / count;
  }

  // Find the strongest continuous region
  let maxSum = 0;
  let bestStart = 0, bestEnd = 0;

  for (let start = 0; start < len; start++) {
    if (smoothed[start] < minStrength) continue;

    let sum = 0;
    let end = start;

    while (end < len && smoothed[end] >= minStrength) {
      sum += smoothed[end];
      end++;
    }

    if (sum > maxSum && (end - start) > len * 0.1) {
      maxSum = sum;
      bestStart = start;
      bestEnd = end - 1;
    }
  }

  if (maxSum === 0) return null;

  return {
    start: bestStart,
    end: bestEnd,
    strength: maxSum / (bestEnd - bestStart + 1)
  };
};

/**
 * Gradient-based document detection
 * @param {Uint8ClampedArray} grayData - Grayscale image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} minArea - Minimum area threshold
 * @returns {Object|null} Document boundary
 */
const gradientBasedDetection = (grayData, width, height, minArea) => {
  try {
    // Calculate gradient magnitude using Scharr operator (more accurate than Sobel)
    const magnitude = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        // Scharr kernels
        const gx =
          -3 * grayData[(y-1)*width + (x-1)] + 3 * grayData[(y-1)*width + (x+1)] +
          -10 * grayData[y*width + (x-1)]    + 10 * grayData[y*width + (x+1)] +
          -3 * grayData[(y+1)*width + (x-1)] + 3 * grayData[(y+1)*width + (x+1)];

        const gy =
          -3 * grayData[(y-1)*width + (x-1)] - 10 * grayData[(y-1)*width + x] - 3 * grayData[(y-1)*width + (x+1)] +
           3 * grayData[(y+1)*width + (x-1)] + 10 * grayData[(y+1)*width + x] + 3 * grayData[(y+1)*width + (x+1)];

        magnitude[y * width + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }

    // Use Otsu's method for automatic thresholding
    const threshold = otsuThreshold(magnitude);

    // Create binary edge map
    const edges = new Uint8ClampedArray(width * height);
    for (let i = 0; i < magnitude.length; i++) {
      edges[i] = magnitude[i] > threshold ? 255 : 0;
    }

    // Find contours and document boundary
    const contours = findContours(edges, width, height);
    return findDocumentBoundary(contours, minArea);

  } catch (error) {
    console.error('Gradient-based detection failed:', error);
    return null;
  }
};

/**
 * Otsu's method for automatic threshold selection
 * @param {Float32Array} data - Input data
 * @returns {number} Optimal threshold
 */
const otsuThreshold = (data) => {
  // Create histogram
  const histogram = new Array(256).fill(0);
  let min = Infinity, max = -Infinity;

  for (let i = 0; i < data.length; i++) {
    const val = Math.min(255, Math.max(0, Math.round(data[i])));
    histogram[val]++;
    min = Math.min(min, val);
    max = Math.max(max, val);
  }

  const total = data.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 0;

  for (let t = min; t <= max; t++) {
    wB += histogram[t];
    if (wB === 0) continue;

    wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = t;
    }
  }

  return threshold;
};

/**
 * Combine multiple detection results
 * @param {Array} results - Array of detection results
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Object} Combined result
 */
const combineDetectionResults = (results) => {
  // For now, return the result with highest weighted confidence
  // Future enhancement: implement actual result fusion
  const best = results.reduce((a, b) =>
    (a.confidence * a.weight) > (b.confidence * b.weight) ? a : b
  );

  // Add metadata about the combination
  best.boundary.combinedFrom = results.map(r => ({
    method: r.method,
    confidence: r.confidence,
    weight: r.weight
  }));

  return best.boundary;
};
