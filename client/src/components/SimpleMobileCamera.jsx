import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Tesseract from "tesseract.js";
import Webcam from "react-webcam";

const SimpleMobileCamera = ({ onTextExtracted, onSolutionGenerated }) => {
  const [isActive, setIsActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  // Check if device is mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const videoConstraints = {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 }
  };

  const startCamera = useCallback(() => {
    const doStart = async () => {
      setError("");
      // Preflight getUserMedia to surface errors early (permissions, not found, insecure context)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera API not supported in this browser');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
        // We have permission; stop preflight tracks and let react-webcam attach when it mounts
        stream.getTracks().forEach(t => t.stop());
        setIsActive(true);
      } catch (err) {
        console.error('Preflight camera access error:', err);
        if (err.name === 'NotAllowedError') {
          setError('Camera permission denied. Please allow camera access and try again.');
        } else if (err.name === 'NotFoundError') {
          setError('No camera found on this device.');
        } else {
          setError('Unable to access camera. Make sure your connection is secure (HTTPS) and permissions are granted.');
        }
      }
    };

    doStart();
  }, []);

  const stopCamera = useCallback(() => {
    try {
      const video = webcamRef.current?.video;
      if (video && video.srcObject) {
        const stream = video.srcObject;
        stream.getTracks().forEach(track => track.stop());
      }
    } catch (e) {
      // ignore
    }
    setIsActive(false);
  }, []);

  const captureImage = useCallback(async () => {
    try {
      setError("");
      if (!webcamRef.current) return;

      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        setError('Failed to capture image');
        return;
      }

      setCapturedImage(imageSrc);

      // convert dataURL to blob
      const res = await fetch(imageSrc);
      const blob = await res.blob();

      await processImage(blob);
      stopCamera();
    } catch (err) {
      console.error('Capture error:', err);
      setError('Failed to capture image');
    }
  }, [stopCamera]);

  // Process captured image with OCR
  const processImage = async (imageBlob) => {
    setIsProcessing(true);
    setError("");

    try {
      const { data: { text } } = await Tesseract.recognize(imageBlob, "eng", {
        logger: m => console.log(m),
        tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        preserve_interword_spaces: '1',
      });

      if (text.trim()) {
        const cleanText = text.trim();
        onTextExtracted?.(cleanText);

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

  const handleUserMediaError = (err) => {
    console.error('Webcam user media error:', err);
    if (err && err.name) {
      if (err.name === 'NotAllowedError') setError('Camera permission denied. Please allow camera access.');
      else if (err.name === 'NotFoundError') setError('No camera found on this device.');
      else setError('Camera error: ' + (err.message || err.name));
    } else {
      setError('Unknown camera error');
    }
    setIsActive(false);
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
          <Webcam
            audio={false}
            ref={webcamRef}
            mirrored={false}
            screenshotFormat="image/jpeg"
            videoConstraints={videoConstraints}
            onUserMediaError={handleUserMediaError}
            className="w-full h-full object-cover rounded-lg"
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

      {/* Hidden canvas for processing (kept for compatibility) */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default SimpleMobileCamera;
