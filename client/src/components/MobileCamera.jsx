import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Tesseract from "tesseract.js";
import { isMobileDevice, hasCameraSupport, getMobileCameraConstraints, getYOLOConfig } from "../utils/deviceDetection";
import { initializeTensorFlow, loadCocoSsdModel, optimizeForMobile } from "../utils/tensorflowSetup";

const MobileCamera = ({ onTextExtracted, onSolutionGenerated }) => {
  const [isActive, setIsActive] = useState(false);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedObjects, setDetectedObjects] = useState([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState("");
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const detectionCanvasRef = useRef(null);
  const yoloModelRef = useRef(null);

  // Enhanced mobile detection and camera support check
  const [isMobile, setIsMobile] = useState(false);
  const [hasCameraAccess, setHasCameraAccess] = useState(false);

  // Check device capabilities on mount
  useEffect(() => {
    const checkDeviceCapabilities = async () => {
      const mobile = isMobileDevice();
      const camera = await hasCameraSupport();

      setIsMobile(mobile);
      setHasCameraAccess(camera);

      if (!mobile) {
        setError("Camera feature is optimized for mobile devices");
      } else if (!camera) {
        setError("Camera not available on this device");
      }
    };

    checkDeviceCapabilities();
  }, []);

  // Load YOLO model with proper TensorFlow.js initialization
  useEffect(() => {
    const loadYOLOModel = async () => {
      if (!isMobile || !hasCameraAccess) return;

      try {
        console.log('📱 Initializing TensorFlow.js for mobile...');

        // Initialize TensorFlow.js first
        const tfReady = await initializeTensorFlow();
        if (!tfReady) {
          throw new Error('TensorFlow.js initialization failed');
        }

        // Optimize for mobile devices
        await optimizeForMobile();

        // Load COCO-SSD model
        console.log('📦 Loading COCO-SSD model...');
        yoloModelRef.current = await loadCocoSsdModel();

        if (yoloModelRef.current) {
          console.log('✅ YOLO model loaded successfully for mobile device');
        } else {
          throw new Error('Model loading returned null');
        }

      } catch (error) {
        console.error('❌ Failed to load YOLO model:', error);
        setError('Object detection unavailable. Camera will work without detection features.');
        // Don't block camera functionality if YOLO fails
      }
    };

    loadYOLOModel();
  }, [isMobile, hasCameraAccess]);

  // Start camera stream with optimized constraints
  const startCamera = useCallback(async () => {
    if (!isMobile || !hasCameraAccess) {
      setError("Camera not available on this device");
      return;
    }

    try {
      setError("");
      console.log('📱 Starting mobile camera...');

      const constraints = getMobileCameraConstraints();
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        console.log('✅ Camera stream started successfully');
      }

      setIsActive(true);

      // Start object detection after camera stabilizes
      setTimeout(() => {
        if (yoloModelRef.current) {
          startObjectDetection();
        } else {
          console.log('⏳ Waiting for YOLO model to load...');
        }
      }, 1500);

    } catch (error) {
      console.error('❌ Camera access error:', error);

      // Provide specific error messages
      if (error.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and try again.');
      } else if (error.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else if (error.name === 'NotReadableError') {
        setError('Camera is being used by another application.');
      } else {
        setError('Unable to access camera. Please check permissions and try again.');
      }
    }
  }, [isMobile, hasCameraAccess]);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsActive(false);
    setIsDetecting(false);
    setDetectedObjects([]);
  }, [stream]);

  // Object detection function
  const detectObjects = useCallback(async () => {
    if (!yoloModelRef.current || !videoRef.current || !isActive) return;

    try {
      const predictions = await yoloModelRef.current.detect(videoRef.current);
      
      // Enhanced filtering for paper-like objects with better accuracy
      const paperObjects = predictions.filter(prediction => {
        const className = prediction.class.toLowerCase();

        // Primary paper/document classes
        const paperClasses = ['book', 'paper', 'document', 'notebook', 'magazine'];

        // Secondary classes that might contain text
        const textClasses = ['laptop', 'cell phone', 'tablet', 'monitor', 'tv'];

        // Check for primary paper classes with lower threshold
        const isPaperClass = paperClasses.some(cls => className.includes(cls));
        if (isPaperClass && prediction.score > 0.2) return true;

        // Check for secondary classes with higher threshold
        const isTextClass = textClasses.some(cls => className.includes(cls));
        if (isTextClass && prediction.score > 0.5) return true;

        // Check for rectangular objects that might be papers
        const [, , width, height] = prediction.bbox;
        const aspectRatio = width / height;
        const isRectangular = aspectRatio > 0.5 && aspectRatio < 2.0; // Reasonable paper aspect ratios
        const isLargeEnough = width > 100 && height > 100; // Minimum size

        return isRectangular && isLargeEnough && prediction.score > 0.4;
      });

      setDetectedObjects(paperObjects);
      
      // Draw detection boxes
      drawDetectionBoxes(paperObjects);
      
    } catch (error) {
      console.error('Object detection error:', error);
    }
  }, [isActive]);

  // Start continuous object detection
  const startObjectDetection = useCallback(() => {
    if (!yoloModelRef.current) return;

    setIsDetecting(true);

    const detectLoop = () => {
      if (isActive && yoloModelRef.current) {
        detectObjects();
        setTimeout(detectLoop, 500); // Detect every 500ms for performance
      }
    };

    detectLoop();
  }, [detectObjects, isActive]);

  // Draw detection boxes on canvas
  const drawDetectionBoxes = (objects) => {
    const canvas = detectionCanvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const ctx = canvas.getContext('2d');

    // Set canvas size to match video display size
    const rect = video.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Calculate scaling factors
    const scaleX = rect.width / video.videoWidth;
    const scaleY = rect.height / video.videoHeight;

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw detection boxes with enhanced visuals
    objects.forEach((obj) => {
      const [x, y, width, height] = obj.bbox;
      const className = obj.class.toLowerCase();

      // Scale coordinates to match canvas size
      const scaledX = x * scaleX;
      const scaledY = y * scaleY;
      const scaledWidth = width * scaleX;
      const scaledHeight = height * scaleY;

      // Different colors for different object types
      let boxColor = '#00ff00'; // Default green
      let confidence = Math.round(obj.score * 100);

      if (className.includes('book') || className.includes('paper') || className.includes('document')) {
        boxColor = '#00ff00'; // Green for paper objects
      } else if (className.includes('laptop') || className.includes('phone') || className.includes('tablet')) {
        boxColor = '#ffaa00'; // Orange for electronic devices
      }

      // Draw bounding box with shadow for better visibility
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      ctx.strokeStyle = boxColor;
      ctx.lineWidth = confidence > 70 ? 4 : 3;
      ctx.setLineDash(confidence > 70 ? [] : [5, 5]); // Solid line for high confidence, dashed for low
      ctx.strokeRect(scaledX, scaledY, scaledWidth, scaledHeight);
      ctx.setLineDash([]); // Reset line dash

      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Draw corner markers for better visibility
      const cornerSize = 20;
      ctx.strokeStyle = boxColor;
      ctx.lineWidth = 3;

      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(scaledX, scaledY + cornerSize);
      ctx.lineTo(scaledX, scaledY);
      ctx.lineTo(scaledX + cornerSize, scaledY);
      ctx.stroke();

      // Top-right corner
      ctx.beginPath();
      ctx.moveTo(scaledX + scaledWidth - cornerSize, scaledY);
      ctx.lineTo(scaledX + scaledWidth, scaledY);
      ctx.lineTo(scaledX + scaledWidth, scaledY + cornerSize);
      ctx.stroke();

      // Bottom-left corner
      ctx.beginPath();
      ctx.moveTo(scaledX, scaledY + scaledHeight - cornerSize);
      ctx.lineTo(scaledX, scaledY + scaledHeight);
      ctx.lineTo(scaledX + cornerSize, scaledY + scaledHeight);
      ctx.stroke();

      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(scaledX + scaledWidth - cornerSize, scaledY + scaledHeight);
      ctx.lineTo(scaledX + scaledWidth, scaledY + scaledHeight);
      ctx.lineTo(scaledX + scaledWidth, scaledY + scaledHeight - cornerSize);
      ctx.stroke();

      // Add pulsing effect for high confidence detections
      if (confidence > 70) {
        const pulseAlpha = 0.3 + 0.2 * Math.sin(Date.now() / 200);
        ctx.fillStyle = `rgba(0, 255, 0, ${pulseAlpha})`;
        ctx.fillRect(scaledX, scaledY, scaledWidth, scaledHeight);
      }

      // Draw label background with rounded corners
      const labelText = `📄 ${obj.class} (${confidence}%)`;
      ctx.font = 'bold 14px Arial';
      const labelWidth = Math.max(150, ctx.measureText(labelText).width + 10);
      const labelHeight = 25;

      // Ensure label stays within canvas bounds
      const labelX = Math.min(scaledX, canvas.width - labelWidth);
      const labelY = Math.max(labelHeight, scaledY);

      ctx.fillStyle = `rgba(0, 0, 0, 0.8)`;
      ctx.fillRect(labelX, labelY - labelHeight, labelWidth, labelHeight);

      // Draw label text
      ctx.fillStyle = boxColor;
      ctx.fillText(labelText, labelX + 5, labelY - 8);

      // Draw accuracy indicator
      if (confidence > 70) {
        ctx.fillStyle = '#00ff00';
        ctx.fillText('✓', labelX + labelWidth - 20, labelY - 8);
      }

      // Draw confidence bar
      const barWidth = 60;
      const barHeight = 4;
      const barX = labelX + 5;
      const barY = labelY - labelHeight + 18;

      // Background bar
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // Confidence bar
      ctx.fillStyle = confidence > 70 ? '#00ff00' : confidence > 50 ? '#ffaa00' : '#ff4444';
      ctx.fillRect(barX, barY, (barWidth * confidence) / 100, barHeight);
    });
  };

  // Capture image with enhanced processing for detected papers
  const captureImage = useCallback(async () => {
    if (!videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // If paper objects detected, crop to the largest detected paper
    let finalCanvas = canvas;
    if (detectedObjects.length > 0) {
      const largestPaper = detectedObjects.reduce((largest, current) => {
        const currentArea = current.bbox[2] * current.bbox[3];
        const largestArea = largest.bbox[2] * largest.bbox[3];
        return currentArea > largestArea ? current : largest;
      });
      
      // Create cropped canvas
      const croppedCanvas = document.createElement('canvas');
      const [x, y, width, height] = largestPaper.bbox;
      
      croppedCanvas.width = width;
      croppedCanvas.height = height;
      
      const croppedCtx = croppedCanvas.getContext('2d');
      croppedCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
      
      finalCanvas = croppedCanvas;
    }
    
    // Convert to blob and process
    finalCanvas.toBlob(async (blob) => {
      const imageUrl = URL.createObjectURL(blob);
      setCapturedImage(imageUrl);
      
      // Process the captured image
      await processImage(blob);
    }, 'image/jpeg', 0.9);
    
    // Stop camera after capture
    stopCamera();
  }, [detectedObjects, stopCamera]);

  // Enhanced image preprocessing for better OCR accuracy
  const preprocessImage = (canvas) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale and enhance contrast
    for (let i = 0; i < data.length; i += 4) {
      // Grayscale conversion
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;

      // Enhance contrast (simple threshold)
      const enhanced = gray > 128 ? 255 : 0;

      data[i] = enhanced;     // Red
      data[i + 1] = enhanced; // Green
      data[i + 2] = enhanced; // Blue
      // Alpha channel remains unchanged
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  };

  // Process captured image with enhanced OCR
  const processImage = async (imageBlob) => {
    setIsProcessing(true);
    setError("");

    try {
      // Create image element for preprocessing
      const img = new Image();
      const imageUrl = URL.createObjectURL(imageBlob);

      img.onload = async () => {
        // Create canvas for preprocessing
        const preprocessCanvas = document.createElement('canvas');
        preprocessCanvas.width = img.width;
        preprocessCanvas.height = img.height;

        const ctx = preprocessCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        // Apply preprocessing
        const processedCanvas = preprocessImage(preprocessCanvas);

        // Convert back to blob
        processedCanvas.toBlob(async (processedBlob) => {
          try {
            // Enhanced OCR processing with multiple PSM modes for better accuracy
            const ocrOptions = {
              logger: m => console.log(m),
              tessedit_pageseg_mode: Tesseract.PSM.AUTO,
              preserve_interword_spaces: '1',
              tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-=()[]{}.,;:!?/\\|<>@#$%^&*_~`"\' ',
            };

            const { data: { text } } = await Tesseract.recognize(processedBlob, "eng", ocrOptions);

            if (text.trim()) {
              const cleanText = text.trim();
              onTextExtracted?.(cleanText);

              // Generate AI solution
              if (onSolutionGenerated) {
                await generateAISolution(cleanText);
              }
            } else {
              setError("No text found in captured image. Try capturing a clearer image with better lighting.");
            }
          } catch (ocrError) {
            console.error('OCR processing error:', ocrError);
            setError("Failed to extract text from image. Please try again with better lighting.");
          } finally {
            setIsProcessing(false);
          }
        }, 'image/jpeg', 0.9);

        // Cleanup
        URL.revokeObjectURL(imageUrl);
      };

      img.src = imageUrl;

    } catch (error) {
      console.error('Image processing error:', error);
      setError("Failed to process captured image");
      setIsProcessing(false);
    }
  };

  // Generate AI solution (simplified version)
  const generateAISolution = async (text) => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/stream-solution`;
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ text })
      });

      if (response.ok) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedText = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            accumulatedText += chunk;
          }
        }
        
        onSolutionGenerated?.(accumulatedText);
      }
    } catch (error) {
      console.error('AI solution error:', error);
    }
  };

  // Handle video resize for canvas overlay
  useEffect(() => {
    const video = videoRef.current;
    const canvas = detectionCanvasRef.current;

    if (!video || !canvas) return;

    const handleResize = () => {
      const rect = video.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    // Initial resize
    handleResize();

    // Listen for video metadata loaded
    video.addEventListener('loadedmetadata', handleResize);
    video.addEventListener('resize', handleResize);

    // Use ResizeObserver if available
    let resizeObserver;
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(handleResize);
      resizeObserver.observe(video);
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleResize);
      video.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Don't render on desktop
  if (!isMobile) {
    return null;
  }

  return (
    <div className="mobile-camera-container">
      <AnimatePresence>
        {!isActive && !capturedImage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center p-6"
          >
            <div className="mb-6">
              <div className="text-6xl mb-4">📱</div>
              <h3 className="text-xl font-semibold mb-2">Mobile Camera</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Use your camera to capture documents and papers with AI-powered object detection
              </p>
            </div>
            
            <motion.button
              onClick={startCamera}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              📷 Start Camera
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera View */}
      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative w-full h-full"
        >
          <video
            ref={videoRef}
            className="w-full h-full object-cover rounded-lg"
            playsInline
            muted
          />
          
          {/* Detection overlay */}
          <canvas
            ref={detectionCanvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none"
            style={{
              zIndex: 10,
              objectFit: 'cover'
            }}
          />
          
          {/* Detection status */}
          {yoloModelRef.current && isDetecting && (
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                🎯 Detecting: {detectedObjects.length} objects
              </div>
              {detectedObjects.length > 0 && (
                <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs">
                  📄 {detectedObjects.filter(obj =>
                    obj.class.toLowerCase().includes('book') ||
                    obj.class.toLowerCase().includes('paper') ||
                    obj.class.toLowerCase().includes('document')
                  ).length} papers detected
                </div>
              )}
            </div>
          )}

          {/* Fallback message when YOLO is not available */}
          {!yoloModelRef.current && isActive && (
            <div className="absolute top-4 left-4 bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
              📷 Camera Ready (Basic Mode)
            </div>
          )}

          {/* Instructions overlay */}
          {isActive && (
            <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg text-sm text-center">
              {detectedObjects.length > 0 ?
                "📄 Paper detected! Tap capture to extract text" :
                "📱 Point camera at documents or papers"
              }
            </div>
          )}
          
          {/* Capture button */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-4">
            <motion.button
              onClick={captureImage}
              className="bg-white text-gray-800 p-4 rounded-full shadow-lg"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              disabled={isProcessing}
            >
              📸
            </motion.button>
            
            <motion.button
              onClick={stopCamera}
              className="bg-red-500 text-white p-4 rounded-full shadow-lg"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              ❌
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Processing state */}
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center p-6"
        >
          <div className="animate-spin text-4xl mb-4">🔄</div>
          <p>Processing captured image...</p>
        </motion.div>
      )}

      {/* Error display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"
        >
          {error}
        </motion.div>
      )}

      {/* Hidden canvases for processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default MobileCamera;
