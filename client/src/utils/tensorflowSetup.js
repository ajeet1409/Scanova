/**
 * TensorFlow.js setup and initialization utilities
 */

let isInitialized = false;
let initializationPromise = null;

/**
 * Initialize TensorFlow.js with appropriate backends
 * @returns {Promise<boolean>} True if initialization successful
 */
export const initializeTensorFlow = async () => {
  // Return existing promise if already initializing
  if (initializationPromise) {
    return initializationPromise;
  }

  // Return true if already initialized
  if (isInitialized) {
    return true;
  }

  initializationPromise = (async () => {
    try {
      console.log('🔧 Initializing TensorFlow.js...');

      // Import TensorFlow.js core
      const tf = await import('@tensorflow/tfjs');

      // Import and register backends
      try {
        // Try WebGL backend first (better performance)
        await import('@tensorflow/tfjs-backend-webgl');
        console.log('✅ WebGL backend loaded');
      } catch (webglError) {
        console.warn('⚠️ WebGL backend failed to load:', webglError);
      }

      try {
        // CPU backend as fallback
        await import('@tensorflow/tfjs-backend-cpu');
        console.log('✅ CPU backend loaded');
      } catch (cpuError) {
        console.warn('⚠️ CPU backend failed to load:', cpuError);
      }

      // Wait for backend initialization
      await tf.ready();

      // Check which backend is being used
      const backend = tf.getBackend();
      console.log(`🚀 TensorFlow.js initialized with backend: ${backend}`);

      // Set memory growth for WebGL backend
      if (backend === 'webgl') {
        tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
      }

      isInitialized = true;
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize TensorFlow.js:', error);
      isInitialized = false;
      return false;
    }
  })();

  return initializationPromise;
};

/**
 * Load COCO-SSD model with proper error handling
 * @returns {Promise<object|null>} Loaded model or null if failed
 */
export const loadCocoSsdModel = async () => {
  try {
    // Ensure TensorFlow.js is initialized first
    const tfInitialized = await initializeTensorFlow();
    if (!tfInitialized) {
      throw new Error('TensorFlow.js initialization failed');
    }

    console.log('📦 Loading COCO-SSD model...');

    // Import and load the model
    const cocoSsd = await import('@tensorflow-models/coco-ssd');
    const model = await cocoSsd.load({
      base: 'lite_mobilenet_v2', // Lighter model for mobile
    });

    console.log('✅ COCO-SSD model loaded successfully');
    return model;

  } catch (error) {
    console.error('❌ Failed to load COCO-SSD model:', error);
    return null;
  }
};

/**
 * Check if TensorFlow.js is properly initialized
 * @returns {boolean} True if initialized
 */
export const isTensorFlowReady = () => {
  return isInitialized;
};

/**
 * Get TensorFlow.js backend information
 * @returns {Promise<object>} Backend information
 */
export const getBackendInfo = async () => {
  try {
    const tf = await import('@tensorflow/tfjs');
    await tf.ready();

    return {
      backend: tf.getBackend(),
      version: tf.version.tfjs,
      memory: tf.memory(),
      environment: tf.env().getFlags()
    };
  } catch (error) {
    console.error('Failed to get backend info:', error);
    return null;
  }
};

/**
 * Cleanup TensorFlow.js resources
 */
export const cleanupTensorFlow = async () => {
  try {
    const tf = await import('@tensorflow/tfjs');
    
    // Dispose of all tensors
    tf.disposeVariables();
    
    // Clear backend
    if (tf.getBackend() === 'webgl') {
      const webglBackend = tf.backend();
      if (webglBackend && webglBackend.dispose) {
        webglBackend.dispose();
      }
    }

    console.log('🧹 TensorFlow.js resources cleaned up');
  } catch (error) {
    console.error('Failed to cleanup TensorFlow.js:', error);
  }
};

/**
 * Optimize TensorFlow.js for mobile devices
 */
export const optimizeForMobile = async () => {
  try {
    const tf = await import('@tensorflow/tfjs');
    
    // Set mobile-optimized flags
    tf.env().set('WEBGL_PACK', true);
    tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
    tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
    tf.env().set('WEBGL_FLUSH_THRESHOLD', -1);
    
    console.log('📱 TensorFlow.js optimized for mobile');
  } catch (error) {
    console.error('Failed to optimize for mobile:', error);
  }
};

export default {
  initializeTensorFlow,
  loadCocoSsdModel,
  isTensorFlowReady,
  getBackendInfo,
  cleanupTensorFlow,
  optimizeForMobile
};
