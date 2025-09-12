import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Tesseract from "tesseract.js";

const SimpleMobileCamera = ({ onTextExtracted, onSolutionGenerated }) => {
  const [isActive, setIsActive] = useState(false);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Check if device is mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      setError("");
      
      const constraints = {
        video: {
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          aspectRatio: { ideal: 16/9 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
      
      setIsActive(true);
      
    } catch (error) {
      console.error('Camera access error:', error);
      if (error.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and try again.');
      } else if (error.name === 'NotFoundError') {
        setError('No camera found on this device.');
      } else {
        setError('Unable to access camera. Please check permissions.');
      }
    }
  }, []);

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsActive(false);
  }, [stream]);

  // Capture image
  const captureImage = useCallback(async () => {
    if (!videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    // Convert to blob and process
    canvas.toBlob(async (blob) => {
      const imageUrl = URL.createObjectURL(blob);
      setCapturedImage(imageUrl);
      
      // Process the captured image
      await processImage(blob);
    }, 'image/jpeg', 0.9);
    
    // Stop camera after capture
    stopCamera();
  }, [stopCamera]);

  // Process captured image with OCR
  const processImage = async (imageBlob) => {
    setIsProcessing(true);
    setError("");

    try {
      // Enhanced OCR processing for better accuracy
      const { data: { text } } = await Tesseract.recognize(imageBlob, "eng", {
        logger: m => console.log(m),
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        preserve_interword_spaces: '1',
      });

      if (text.trim()) {
        const cleanText = text.trim();
        onTextExtracted?.(cleanText);
        
        // Generate AI solution
        if (onSolutionGenerated) {
          await generateAISolution(cleanText);
        }
      } else {
        setError("No text found in captured image");
      }
    } catch (error) {
      console.error('OCR processing error:', error);
      setError("Failed to process captured image");
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate AI solution
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
                Capture documents and papers with your camera
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
          
          {/* Camera ready indicator */}
          <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm">
            📷 Camera Ready
          </div>
          
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

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default SimpleMobileCamera;
