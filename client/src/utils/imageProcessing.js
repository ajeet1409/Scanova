/**
 * Advanced Image Processing Utilities for Document Detection and OCR
 * Provides robust image preprocessing, document detection, and perspective correction
 */

/**
 * Apply Gaussian blur to reduce noise
 * @param {ImageData} imageData - Input image data
 * @param {number} radius - Blur radius
 * @returns {ImageData} Blurred image data
 */
export const gaussianBlur = (imageData, radius = 1) => {
  const { data, width, height } = imageData;
  const output = new ImageData(width, height);
  const kernel = createGaussianKernel(radius);
  const kernelSize = kernel.length;
  const half = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      let weightSum = 0;

      for (let ky = -half; ky <= half; ky++) {
        for (let kx = -half; kx <= half; kx++) {
          const px = Math.min(Math.max(x + kx, 0), width - 1);
          const py = Math.min(Math.max(y + ky, 0), height - 1);
          const idx = (py * width + px) * 4;
          const weight = kernel[ky + half][kx + half];

          r += data[idx] * weight;
          g += data[idx + 1] * weight;
          b += data[idx + 2] * weight;
          a += data[idx + 3] * weight;
          weightSum += weight;
        }
      }

      const outIdx = (y * width + x) * 4;
      output.data[outIdx] = r / weightSum;
      output.data[outIdx + 1] = g / weightSum;
      output.data[outIdx + 2] = b / weightSum;
      output.data[outIdx + 3] = a / weightSum;
    }
  }

  return output;
};

/**
 * Create Gaussian kernel for blur operations
 * @param {number} radius - Kernel radius
 * @returns {number[][]} 2D Gaussian kernel
 */
const createGaussianKernel = (radius) => {
  const size = 2 * radius + 1;
  const kernel = [];
  const sigma = radius / 3;
  const twoSigmaSquare = 2 * sigma * sigma;
  let sum = 0;

  for (let y = -radius; y <= radius; y++) {
    const row = [];
    for (let x = -radius; x <= radius; x++) {
      const value = Math.exp(-(x * x + y * y) / twoSigmaSquare);
      row.push(value);
      sum += value;
    }
    kernel.push(row);
  }

  // Normalize kernel
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      kernel[y][x] /= sum;
    }
  }

  return kernel;
};

/**
 * Convert image to grayscale with optimized weights
 * @param {ImageData} imageData - Input image data
 * @returns {Uint8ClampedArray} Grayscale pixel data
 */
export const toGrayscale = (imageData) => {
  const { data, width, height } = imageData;
  const gray = new Uint8ClampedArray(width * height);

  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    // Use luminance formula for better text contrast
    gray[j] = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }

  return gray;
};

/**
 * Apply adaptive thresholding for better text extraction
 * @param {Uint8ClampedArray} grayData - Grayscale image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} blockSize - Size of neighborhood area
 * @param {number} C - Constant subtracted from mean
 * @returns {Uint8ClampedArray} Binary image data
 */
export const adaptiveThreshold = (grayData, width, height, blockSize = 15, C = 10) => {
  // Validate inputs
  if (!grayData || width <= 0 || height <= 0 || width * height > 10000000) {
    console.warn('Invalid parameters for adaptiveThreshold:', { width, height, dataLength: grayData?.length });
    return new Uint8ClampedArray(0);
  }

  const totalPixels = width * height;
  if (grayData.length !== totalPixels) {
    console.warn('Data length mismatch in adaptiveThreshold:', { expected: totalPixels, actual: grayData.length });
    return new Uint8ClampedArray(totalPixels);
  }

  const binary = new Uint8ClampedArray(totalPixels);
  const half = Math.floor(blockSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;

      // Calculate mean in neighborhood
      for (let dy = -half; dy <= half; dy++) {
        for (let dx = -half; dx <= half; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            sum += grayData[ny * width + nx];
            count++;
          }
        }
      }

      const mean = sum / count;
      const threshold = mean - C;
      const idx = y * width + x;
      binary[idx] = grayData[idx] > threshold ? 255 : 0;
    }
  }

  return binary;
};

/**
 * Enhanced Sobel edge detection with improved gradient calculation
 * @param {Uint8ClampedArray} grayData - Grayscale image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Object} Edge magnitude and direction data
 */
export const sobelEdgeDetection = (grayData, width, height) => {
  // Validate inputs
  if (!grayData || width <= 0 || height <= 0 || width * height > 10000000) {
    console.warn('Invalid parameters for sobelEdgeDetection:', { width, height, dataLength: grayData?.length });
    return { magnitude: new Float32Array(0), direction: new Float32Array(0) };
  }

  const totalPixels = width * height;
  const magnitude = new Float32Array(totalPixels);
  const direction = new Float32Array(totalPixels);

  // Sobel kernels
  const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
  const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;

      // Apply Sobel kernels
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const pixel = grayData[(y + ky) * width + (x + kx)];
          gx += pixel * sobelX[ky + 1][kx + 1];
          gy += pixel * sobelY[ky + 1][kx + 1];
        }
      }

      const idx = y * width + x;
      magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
      direction[idx] = Math.atan2(gy, gx);
    }
  }

  return { magnitude, direction };
};

/**
 * Non-maximum suppression for edge thinning
 * @param {Float32Array} magnitude - Edge magnitude
 * @param {Float32Array} direction - Edge direction
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Float32Array} Suppressed edge magnitude
 */
export const nonMaximumSuppression = (magnitude, direction, width, height) => {
  const suppressed = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const angle = direction[idx];
      const mag = magnitude[idx];

      // Determine gradient direction
      let q = 255, r = 255;
      const angle_deg = (angle * 180 / Math.PI + 180) % 180;

      if ((0 <= angle_deg < 22.5) || (157.5 <= angle_deg <= 180)) {
        q = magnitude[idx + 1];
        r = magnitude[idx - 1];
      } else if (22.5 <= angle_deg < 67.5) {
        q = magnitude[(y - 1) * width + (x + 1)];
        r = magnitude[(y + 1) * width + (x - 1)];
      } else if (67.5 <= angle_deg < 112.5) {
        q = magnitude[(y - 1) * width + x];
        r = magnitude[(y + 1) * width + x];
      } else if (112.5 <= angle_deg < 157.5) {
        q = magnitude[(y - 1) * width + (x - 1)];
        r = magnitude[(y + 1) * width + (x + 1)];
      }

      if (mag >= q && mag >= r) {
        suppressed[idx] = mag;
      } else {
        suppressed[idx] = 0;
      }
    }
  }

  return suppressed;
};

/**
 * Hysteresis thresholding for edge linking
 * @param {Float32Array} edges - Edge magnitude after NMS
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} lowThreshold - Low threshold value
 * @param {number} highThreshold - High threshold value
 * @returns {Uint8ClampedArray} Final edge map
 */
export const hysteresisThresholding = (edges, width, height, lowThreshold, highThreshold) => {
  const result = new Uint8ClampedArray(width * height);
  const visited = new Array(width * height).fill(false);

  // Mark strong edges
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] >= highThreshold) {
      result[i] = 255;
    } else if (edges[i] >= lowThreshold) {
      result[i] = 128; // Weak edge
    }
  }

  // Connect weak edges to strong edges
  const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

  const dfs = (x, y) => {
    const idx = y * width + x;
    if (visited[idx] || result[idx] === 0) return;
    
    visited[idx] = true;
    if (result[idx] === 128) result[idx] = 255;

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nIdx = ny * width + nx;
        if (!visited[nIdx] && result[nIdx] >= 128) {
          dfs(nx, ny);
        }
      }
    }
  };

  // Start DFS from strong edges
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (result[idx] === 255 && !visited[idx]) {
        dfs(x, y);
      }
    }
  }

  // Remove remaining weak edges
  for (let i = 0; i < result.length; i++) {
    if (result[i] === 128) result[i] = 0;
  }

  return result;
};

/**
 * Enhanced Canny edge detection
 * @param {Uint8ClampedArray} grayData - Grayscale image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} lowThreshold - Low threshold for hysteresis
 * @param {number} highThreshold - High threshold for hysteresis
 * @returns {Uint8ClampedArray} Edge map
 */
export const cannyEdgeDetection = (grayData, width, height, lowThreshold = 50, highThreshold = 150) => {
  // Step 1: Apply Gaussian blur to reduce noise
  const imageData = new ImageData(new Uint8ClampedArray(width * height * 4), width, height);
  for (let i = 0; i < grayData.length; i++) {
    const idx = i * 4;
    imageData.data[idx] = imageData.data[idx + 1] = imageData.data[idx + 2] = grayData[i];
    imageData.data[idx + 3] = 255;
  }
  
  const blurred = gaussianBlur(imageData, 1);
  const blurredGray = toGrayscale(blurred);

  // Step 2: Calculate gradients
  const { magnitude, direction } = sobelEdgeDetection(blurredGray, width, height);

  // Step 3: Non-maximum suppression
  const suppressed = nonMaximumSuppression(magnitude, direction, width, height);

  // Step 4: Hysteresis thresholding
  return hysteresisThresholding(suppressed, width, height, lowThreshold, highThreshold);
};

/**
 * Find contours in binary image using border following algorithm
 * @param {Uint8ClampedArray} binaryData - Binary image data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Array} Array of contours, each contour is an array of points
 */
export const findContours = (binaryData, width, height) => {
  // Validate inputs
  if (!binaryData || width <= 0 || height <= 0 || width * height > 10000000) {
    console.warn('Invalid parameters for findContours:', { width, height, dataLength: binaryData?.length });
    return [];
  }

  const contours = [];
  const totalPixels = width * height;
  const visited = new Array(totalPixels).fill(false);

  // 8-connectivity directions
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ];

  const isValidPoint = (x, y) => x >= 0 && x < width && y >= 0 && y < height;
  const getPixel = (x, y) => {
    if (!isValidPoint(x, y)) return 0;
    const index = y * width + x;
    return index < binaryData.length ? binaryData[index] : 0;
  };

  // Border following algorithm with safety limits
  const traceContour = (startX, startY) => {
    const contour = [];
    let x = startX, y = startY;
    let dir = 0; // Start direction
    let iterations = 0;
    const maxIterations = Math.min(10000, width * height); // Safety limit

    do {
      contour.push({ x, y });
      const index = y * width + x;
      if (index >= 0 && index < visited.length) {
        visited[index] = true;
      }

      // Find next boundary point
      let found = false;
      for (let i = 0; i < 8; i++) {
        const newDir = (dir + i) % 8;
        const [dx, dy] = directions[newDir];
        const nx = x + dx;
        const ny = y + dy;

        if (getPixel(nx, ny) === 255) {
          x = nx;
          y = ny;
          dir = (newDir + 6) % 8; // Turn left
          found = true;
          break;
        }
      }

      if (!found) break;

      iterations++;
      if (iterations > maxIterations) {
        console.warn('Contour tracing exceeded maximum iterations');
        break;
      }

    } while ((x !== startX || y !== startY) && iterations < maxIterations);

    return contour;
  };

  // Find all contours
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binaryData[idx] === 255 && !visited[idx]) {
        // Check if this is a boundary point
        let isBoundary = false;
        for (const [dx, dy] of directions) {
          if (getPixel(x + dx, y + dy) === 0) {
            isBoundary = true;
            break;
          }
        }

        if (isBoundary) {
          const contour = traceContour(x, y);
          if (contour.length > 10) { // Filter small contours
            contours.push(contour);
          }
        }
      }
    }
  }

  return contours;
};

/**
 * Approximate contour using Douglas-Peucker algorithm
 * @param {Array} contour - Array of points
 * @param {number} epsilon - Approximation accuracy
 * @returns {Array} Simplified contour
 */
export const approximateContour = (contour, epsilon = 2.0) => {
  if (contour.length < 3) return contour;

  const distance = (p1, p2, p) => {
    const A = p.x - p1.x;
    const B = p.y - p1.y;
    const C = p2.x - p1.x;
    const D = p2.y - p1.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) return Math.sqrt(A * A + B * B);

    const param = dot / lenSq;
    let xx, yy;

    if (param < 0) {
      xx = p1.x;
      yy = p1.y;
    } else if (param > 1) {
      xx = p2.x;
      yy = p2.y;
    } else {
      xx = p1.x + param * C;
      yy = p1.y + param * D;
    }

    const dx = p.x - xx;
    const dy = p.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const douglasPeucker = (points, start, end, epsilon) => {
    if (end <= start + 1) return [points[start]];

    let maxDist = 0;
    let maxIndex = start;

    for (let i = start + 1; i < end; i++) {
      const dist = distance(points[start], points[end], points[i]);
      if (dist > maxDist) {
        maxDist = dist;
        maxIndex = i;
      }
    }

    if (maxDist > epsilon) {
      const left = douglasPeucker(points, start, maxIndex, epsilon);
      const right = douglasPeucker(points, maxIndex, end, epsilon);
      return [...left, ...right.slice(1)];
    } else {
      return [points[start]];
    }
  };

  const simplified = douglasPeucker(contour, 0, contour.length - 1, epsilon);
  simplified.push(contour[contour.length - 1]);
  return simplified;
};

/**
 * Find the largest rectangular contour (document boundary)
 * @param {Array} contours - Array of contours
 * @param {number} minArea - Minimum area threshold
 * @returns {Object|null} Document boundary or null
 */
export const findDocumentBoundary = (contours, minArea = 1000) => {
  let bestContour = null;
  let bestScore = 0;

  for (const contour of contours) {
    if (contour.length < 4) continue;

    // Approximate contour to polygon
    const approx = approximateContour(contour, contour.length * 0.02);

    // Calculate area
    const area = calculateContourArea(contour);
    if (area < minArea) continue;

    // Calculate rectangularity score
    const rectangularityScore = calculateRectangularityScore(approx, area);

    // Prefer contours with 4 corners (quadrilaterals)
    const cornerBonus = approx.length === 4 ? 1.5 : 1.0;
    const score = rectangularityScore * cornerBonus * Math.sqrt(area);

    if (score > bestScore) {
      bestScore = score;
      bestContour = {
        contour: approx,
        area,
        score,
        boundingBox: calculateBoundingBox(contour)
      };
    }
  }

  return bestContour;
};

/**
 * Calculate contour area using shoelace formula
 * @param {Array} contour - Array of points
 * @returns {number} Area
 */
const calculateContourArea = (contour) => {
  let area = 0;
  const n = contour.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += contour[i].x * contour[j].y;
    area -= contour[j].x * contour[i].y;
  }

  return Math.abs(area) / 2;
};

/**
 * Calculate how rectangular a contour is
 * @param {Array} contour - Array of points
 * @param {number} area - Contour area
 * @returns {number} Rectangularity score (0-1)
 */
const calculateRectangularityScore = (contour, area) => {
  const bbox = calculateBoundingBox(contour);
  const bboxArea = bbox.width * bbox.height;

  if (bboxArea === 0) return 0;

  // How well the contour fills its bounding box
  const fillRatio = area / bboxArea;

  // Check for right angles if it's a quadrilateral
  let angleScore = 1.0;
  if (contour.length === 4) {
    angleScore = calculateAngleScore(contour);
  }

  return fillRatio * angleScore;
};

/**
 * Calculate bounding box of contour
 * @param {Array} contour - Array of points
 * @returns {Object} Bounding box {x, y, width, height}
 */
const calculateBoundingBox = (contour) => {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const point of contour) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
};

/**
 * Calculate angle score for quadrilateral (how close angles are to 90 degrees)
 * @param {Array} contour - Array of 4 points
 * @returns {number} Angle score (0-1)
 */
const calculateAngleScore = (contour) => {
  if (contour.length !== 4) return 0;

  const angles = [];
  for (let i = 0; i < 4; i++) {
    const p1 = contour[i];
    const p2 = contour[(i + 1) % 4];
    const p3 = contour[(i + 2) % 4];

    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

    if (mag1 === 0 || mag2 === 0) continue;

    const angle = Math.acos(Math.max(-1, Math.min(1, dot / (mag1 * mag2))));
    angles.push(Math.abs(angle - Math.PI / 2)); // Distance from 90 degrees
  }

  if (angles.length === 0) return 0;

  const avgAngleError = angles.reduce((sum, angle) => sum + angle, 0) / angles.length;
  return Math.max(0, 1 - (avgAngleError / (Math.PI / 4))); // Normalize to 0-1
};
