/**
 * Enhanced mobile device detection utilities
 */

/**
 * Detect if the current device is mobile
 * @returns {boolean} True if mobile device
 */
export const isMobileDevice = () => {
  // Check user agent
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Mobile user agent patterns
  const mobilePatterns = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /IEMobile/i,
    /Opera Mini/i,
    /Mobile/i,
    /mobile/i,
    /CriOS/i
  ];
  
  const isMobileUA = mobilePatterns.some(pattern => pattern.test(userAgent));
  
  // Check screen size (mobile-like dimensions)
  const isMobileScreen = window.innerWidth <= 768 || window.innerHeight <= 768;
  
  // Check touch capability
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Check device orientation API (mobile feature)
  const hasOrientationAPI = 'orientation' in window;
  
  // Combine checks for better accuracy
  return isMobileUA || (isMobileScreen && isTouchDevice) || hasOrientationAPI;
};

/**
 * Check if device has camera capability
 * @returns {Promise<boolean>} True if camera is available
 */
export const hasCameraSupport = async () => {
  try {
    // Check if getUserMedia is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }
    
    // Try to enumerate devices to check for camera
    const devices = await navigator.mediaDevices.enumerateDevices();
    const hasVideoInput = devices.some(device => device.kind === 'videoinput');
    
    return hasVideoInput;
  } catch (error) {
    console.error('Camera support check failed:', error);
    return false;
  }
};

/**
 * Get optimal camera constraints for mobile devices
 * @returns {object} Camera constraints optimized for mobile
 */
export const getMobileCameraConstraints = () => {
  return {
    video: {
      facingMode: 'environment', // Use back camera
      width: { 
        ideal: 1920, 
        max: 1920,
        min: 640 
      },
      height: { 
        ideal: 1080, 
        max: 1080,
        min: 480 
      },
      aspectRatio: { 
        ideal: 16/9,
        min: 4/3,
        max: 21/9 
      },
      frameRate: { 
        ideal: 30,
        max: 30 
      }
    }
  };
};

/**
 * Check if device is in landscape mode
 * @returns {boolean} True if landscape
 */
export const isLandscapeMode = () => {
  return window.innerWidth > window.innerHeight;
};

/**
 * Get device pixel ratio for high-DPI displays
 * @returns {number} Device pixel ratio
 */
export const getDevicePixelRatio = () => {
  return window.devicePixelRatio || 1;
};

/**
 * Check if device supports WebGL (needed for TensorFlow.js)
 * @returns {boolean} True if WebGL is supported
 */
export const hasWebGLSupport = () => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (error) {
    return false;
  }
};

/**
 * Get optimal canvas size for mobile processing
 * @returns {object} Optimal width and height
 */
export const getOptimalCanvasSize = () => {
  const maxSize = isMobileDevice() ? 1024 : 2048;
  const pixelRatio = getDevicePixelRatio();
  
  return {
    width: Math.min(maxSize, window.innerWidth * pixelRatio),
    height: Math.min(maxSize, window.innerHeight * pixelRatio)
  };
};

/**
 * Check if device has sufficient memory for ML models
 * @returns {boolean} True if sufficient memory
 */
export const hasSufficientMemory = () => {
  // Check if navigator.deviceMemory is available (Chrome only)
  if ('deviceMemory' in navigator) {
    return navigator.deviceMemory >= 2; // At least 2GB RAM
  }
  
  // Fallback: assume mobile devices have sufficient memory if they support WebGL
  return hasWebGLSupport();
};

/**
 * Get recommended YOLO model configuration for device
 * @returns {object} Model configuration
 */
export const getYOLOConfig = () => {
  const isMobile = isMobileDevice();
  const hasGoodMemory = hasSufficientMemory();
  
  return {
    modelUrl: isMobile ? 
      'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2' : 
      'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd@2.2.2',
    
    // Detection settings
    maxDetections: isMobile ? 10 : 20,
    scoreThreshold: isMobile ? 0.3 : 0.2,
    
    // Performance settings
    detectionInterval: isMobile ? 1000 : 500, // ms between detections
    
    // Canvas settings
    maxCanvasSize: isMobile ? 640 : 1280,
    
    // Memory optimization
    enableMemoryOptimization: isMobile || !hasGoodMemory
  };
};

export default {
  isMobileDevice,
  hasCameraSupport,
  getMobileCameraConstraints,
  isLandscapeMode,
  getDevicePixelRatio,
  hasWebGLSupport,
  getOptimalCanvasSize,
  hasSufficientMemory,
  getYOLOConfig
};
