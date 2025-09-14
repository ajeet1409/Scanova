import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import * as tf from "@tensorflow/tfjs";
import * as cocossd from "@tensorflow-models/coco-ssd";
import { detectDocument } from "../utils/documentDetection.js";
import { enhancedOCR, validateOCRResult } from "../utils/enhancedOCR.js";
import { loadCocoSsdModel, optimizeForMobile } from "../utils/tensorflowSetup.js";

const MobileCamera = ({ onTextExtracted, onSolutionGenerated }) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null); // overlay canvas
  const tmpCanvasRef = useRef(document.createElement("canvas")); // offscreen

  // default to rear camera
  const [cameraMode, setCameraMode] = useState("environment");
  const [isLoading, setIsLoading] = useState(false);
  const [net, setNet] = useState(null);
  const [docBBox, setDocBBox] = useState(null); // {x,y,w,h}
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [ocrText, setOcrText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [detectionMethod, setDetectionMethod] = useState("");
  const [processingStats, setProcessingStats] = useState(null);
  const lastExtractHashRef = useRef(null);
  const extractionTimerRef = useRef(null);

  // Initialize enhanced COCO-SSD model with optimizations
  const runCoco = async () => {
    try {
      setIsLoading(true);

      // Optimize TensorFlow for mobile
      await optimizeForMobile();

      // Load enhanced COCO-SSD model
      const model = await loadCocoSsdModel();
      if (model) {
        setNet(model);
        console.log('✅ Enhanced COCO-SSD model loaded successfully');
      } else {
        console.warn('⚠️ Failed to load COCO-SSD model, falling back to edge detection only');
      }

      setIsLoading(false);
    } catch (err) {
      console.error('❌ Failed to initialize model:', err);
      setIsLoading(false);
    }
  };

  // Enhanced overlay drawing with better visual feedback
  const drawOverlay = (bbox, score, label) => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    const vidW = video.videoWidth || video.clientWidth;
    const vidH = video.videoHeight || video.clientHeight;
    canvas.width = vidW;
    canvas.height = vidH;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (bbox) {
      // Determine color based on confidence/score
      let color = '#00ff00'; // Default green
      if (typeof score === 'number') {
        if (score < 0.3) color = '#ff6b6b'; // Red for low confidence
        else if (score < 0.6) color = '#ffd93d'; // Yellow for medium confidence
        else color = '#6bcf7f'; // Green for high confidence
      }

      // Draw main bounding box
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(3, Math.round(4 * (canvas.width / 640)));
      ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);

      // Draw corner indicators for better visibility
      const cornerSize = Math.max(15, Math.round(20 * (canvas.width / 640)));
      ctx.lineWidth = Math.max(4, Math.round(5 * (canvas.width / 640)));

      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(bbox.x, bbox.y + cornerSize);
      ctx.lineTo(bbox.x, bbox.y);
      ctx.lineTo(bbox.x + cornerSize, bbox.y);
      ctx.stroke();

      // Top-right corner
      ctx.beginPath();
      ctx.moveTo(bbox.x + bbox.w - cornerSize, bbox.y);
      ctx.lineTo(bbox.x + bbox.w, bbox.y);
      ctx.lineTo(bbox.x + bbox.w, bbox.y + cornerSize);
      ctx.stroke();

      // Bottom-left corner
      ctx.beginPath();
      ctx.moveTo(bbox.x, bbox.y + bbox.h - cornerSize);
      ctx.lineTo(bbox.x, bbox.y + bbox.h);
      ctx.lineTo(bbox.x + cornerSize, bbox.y + bbox.h);
      ctx.stroke();

      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(bbox.x + bbox.w - cornerSize, bbox.y + bbox.h);
      ctx.lineTo(bbox.x + bbox.w, bbox.y + bbox.h);
      ctx.lineTo(bbox.x + bbox.w, bbox.y + bbox.h - cornerSize);
      ctx.stroke();

      // Draw label with enhanced background
      const confidence = typeof score === 'number' ? Math.round(score * 100) : Math.round(score || 0);
      const text = `${label || 'Document'} ${confidence}%`;

      ctx.font = 'bold 16px sans-serif';
      const textMetrics = ctx.measureText(text);
      const textWidth = textMetrics.width;
      const labelHeight = 28;

      // Enhanced label background with gradient
      const gradient = ctx.createLinearGradient(bbox.x, bbox.y - labelHeight, bbox.x, bbox.y);
      gradient.addColorStop(0, 'rgba(0,0,0,0.8)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.6)');

      ctx.fillStyle = gradient;
      ctx.fillRect(bbox.x, Math.max(0, bbox.y - labelHeight), Math.min(textWidth + 16, bbox.w), labelHeight);

      // Label text
      ctx.fillStyle = color;
      ctx.fillText(text, bbox.x + 8, Math.max(18, bbox.y - 8));

      // Add scanning animation effect when processing
      if (isProcessing) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(bbox.x + 4, bbox.y + 4, bbox.w - 8, bbox.h - 8);
        ctx.setLineDash([]); // Reset dash
      }
    }
  };

  // Capture current frame to an offscreen canvas and return it
  const captureFrameCanvas = () => {
    const video = webcamRef.current?.video;
    if (!video) return null;
    const c = tmpCanvasRef.current;
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(video, 0, 0, c.width, c.height);
    return c;
  };

  // Simple Sobel-based edge detector -> compute bounding box of strong-edge region
  const findDocumentByEdges = (canvas) => {
    try {
      const w = canvas.width;
      const h = canvas.height;
      const ctx = canvas.getContext('2d');
      const img = ctx.getImageData(0, 0, w, h);
      const data = img.data;

      // convert to grayscale
      const gray = new Uint8ClampedArray(w * h);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        gray[j] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
      }

      // Sobel kernels
      const gx = new Int16Array(w * h);
      const gy = new Int16Array(w * h);
      const mag = new Uint8ClampedArray(w * h);

      const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let sumX = 0;
          let sumY = 0;
          let idx = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const px = x + kx;
              const py = y + ky;
              const p = gray[py * w + px];
              sumX += p * kernelX[idx];
              sumY += p * kernelY[idx];
              idx++;
            }
          }
          const pos = y * w + x;
          gx[pos] = sumX;
          gy[pos] = sumY;
          const g = Math.hypot(sumX, sumY);
          mag[pos] = g > 255 ? 255 : g;
        }
      }

      // threshold edges using Otsu-like estimate: mean
      let sum = 0;
      for (let i = 0; i < mag.length; i++) sum += mag[i];
      const mean = sum / mag.length;
      const thresh = Math.max(50, mean * 1.5);

      // compute projection to find dense edge area
      const colCounts = new Uint32Array(w);
      const rowCounts = new Uint32Array(h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (mag[y * w + x] >= thresh) {
            colCounts[x]++;
            rowCounts[y]++;
          }
        }
      }

      // find contiguous region where counts exceed small percentage of width/height
      const colThreshold = Math.max(2, h * 0.01);
      const rowThreshold = Math.max(2, w * 0.01);

      let minX = w, maxX = 0, minY = h, maxY = 0;
      for (let x = 0; x < w; x++) {
        if (colCounts[x] > colThreshold) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
      for (let y = 0; y < h; y++) {
        if (rowCounts[y] > rowThreshold) {
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }

      if (maxX - minX > 50 && maxY - minY > 50) {
        // pad a little
        const padX = Math.round((maxX - minX) * 0.05);
        const padY = Math.round((maxY - minY) * 0.05);
        const x = Math.max(0, minX - padX);
        const y = Math.max(0, minY - padY);
        const wbox = Math.min(w - x, maxX - minX + padX * 2);
        const hbox = Math.min(h - y, maxY - minY + padY * 2);
        return { x, y, w: wbox, h: hbox };
      }

      return null;
    } catch (err) {
      console.error('Edge detection failed', err);
      return null;
    }
  };

  // Enhanced detection loop using multiple approaches
  const detectLoop = async () => {
    if (!webcamRef.current || !webcamRef.current.video) return;
    const video = webcamRef.current.video;
    if (video.readyState !== 4) return;

    const videoW = video.videoWidth;
    const videoH = video.videoHeight;
    let detectedDoc = null;
    let method = 'none';

    try {
      // Method 1: COCO-SSD model detection (if available)
      if (net) {
        try {
          const preds = await net.detect(video);
          const paperPreds = preds.filter(p => {
            const cls = (p.class || '').toLowerCase();
            return ['book', 'paper', 'document', 'notebook', 'magazine', 'laptop', 'cell phone'].some(k => cls.includes(k));
          });

          if (paperPreds.length > 0) {
            const best = paperPreds.reduce((a, b) => (a.bbox[2] * a.bbox[3] > b.bbox[2] * b.bbox[3]) ? a : b);
            const [x, y, w, h] = best.bbox;

            // Validate detection bounds
            if (w > videoW * 0.1 && h > videoH * 0.1) {
              detectedDoc = {
                x: Math.max(0, x),
                y: Math.max(0, y),
                w: Math.min(videoW - x, w),
                h: Math.min(videoH - y, h),
                confidence: best.score,
                class: best.class
              };
              method = `coco-ssd-${best.class}`;
            }
          }
        } catch (err) {
          console.warn('COCO-SSD detection failed:', err);
        }
      }

      // Method 2: Enhanced document detection (if COCO-SSD didn't find anything good)
      if (!detectedDoc || detectedDoc.confidence < 0.6) {
        const frame = captureFrameCanvas();
        if (frame) {
          const enhancedDoc = detectDocument(frame, {
            minArea: (videoW * videoH) * 0.05, // At least 5% of frame
            cannyLow: 50,
            cannyHigh: 150,
            useAdaptiveThreshold: true,
            combineResults: true
          });

          if (enhancedDoc && enhancedDoc.score > 0.3) {
            const bbox = enhancedDoc.boundingBox;
            const newDoc = {
              x: bbox.x,
              y: bbox.y,
              w: bbox.width,
              h: bbox.height,
              confidence: enhancedDoc.score,
              class: 'document'
            };

            // Use enhanced detection if it's better than COCO-SSD result
            if (!detectedDoc || enhancedDoc.score > detectedDoc.confidence * 0.8) {
              detectedDoc = newDoc;
              method = enhancedDoc.combinedFrom ?
                `multi-${enhancedDoc.combinedFrom.map(r => r.method).join('+')}` :
                'enhanced-edge';
            }
          }
        }
      }

      // Update state and UI
      if (detectedDoc) {
        setDocBBox(detectedDoc);
        setDetectionMethod(method);
        drawOverlay(detectedDoc, detectedDoc.confidence, detectedDoc.class);
      } else {
        setDocBBox(null);
        setDetectionMethod('none');
        // Clear overlay
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

    } catch (error) {
      console.error('Detection loop error:', error);
    }
  };

  // Run continuous detection using requestAnimationFrame loop
  useEffect(() => {
    let raf = 0;
    const loop = async () => {
      await detectLoop();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [net]);

  // const runHandPose = async () => {
  //   setisLoading(true);
  //   await tf.setBackend("webgl");
  //   await tf.ready();
  //   console.log("Loading handpose model...");
  //   const net = await handpose.load();
  //   console.log("Handpose model loaded ✅");
  //   setisLoading(false);
  //   setInterval(() => {
  //     detect1(net);
  //   }, 100);
  // };

  useEffect(() => {
    runCoco();
  }, []);

  // Default to rear camera on mobile devices
  useEffect(() => {
    try {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
      if (isMobile) {
        setCameraMode('environment');
      }
    } catch (e) {}
  }, []);

  // Try to enumerate devices and pick a rear camera deviceId if available
  useEffect(() => {
    const pickRearDevice = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

      try {
        // Request temporary permission to get device labels on some browsers
        let tempStream = null;
        try {
          tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (err) {
          // ignore: permission may be denied — we'll still try to enumerate
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter(d => d.kind === 'videoinput');

        // Prefer devices whose label suggests a back/rear camera
        const rearKeywords = ['back', 'rear', 'environment', 'rück', 'traseira'];
        let found = null;
        for (const d of videoInputs) {
          const label = (d.label || '').toLowerCase();
          if (rearKeywords.some(k => label.includes(k))) {
            found = d;
            break;
          }
        }

        // Fallback: if only one camera, use it; otherwise prefer the last device (often rear)
        if (!found && videoInputs.length === 1) found = videoInputs[0];
        if (!found && videoInputs.length > 1) found = videoInputs[videoInputs.length - 1];

        if (found) {
          setSelectedDeviceId(found.deviceId);
        }

        if (tempStream) {
          tempStream.getTracks().forEach(t => t.stop());
        }
      } catch (err) {
        console.warn('Device enumeration failed', err);
      }
    };

    pickRearDevice();
  }, []);

  // Auto-extract OCR when a document bbox is stably detected
  useEffect(() => {
    // clear pending timer
    if (extractionTimerRef.current) {
      clearTimeout(extractionTimerRef.current);
      extractionTimerRef.current = null;
    }

    if (!docBBox) return;

    const hash = `${Math.round(docBBox.x)}:${Math.round(docBBox.y)}:${Math.round(docBBox.w)}:${Math.round(docBBox.h)}`;
    if (lastExtractHashRef.current === hash) return; // already extracted this bbox

    // Wait briefly to ensure stable detection (debounce)
    extractionTimerRef.current = setTimeout(async () => {
      // Double-check bbox still exists
      if (!docBBox) return;
      const currentHash = `${Math.round(docBBox.x)}:${Math.round(docBBox.y)}:${Math.round(docBBox.w)}:${Math.round(docBBox.h)}`;
      if (lastExtractHashRef.current === currentHash) return;

      try {
        setIsProcessing(true);
        setOcrConfidence(0);
        setProcessingStats(null);

        // Capture and crop the document region
        const frame = captureFrameCanvas();
        if (!frame) return;

        const crop = document.createElement('canvas');
        crop.width = Math.max(1, Math.round(docBBox.w));
        crop.height = Math.max(1, Math.round(docBBox.h));
        const cctx = crop.getContext('2d');
        cctx.drawImage(frame, docBBox.x, docBBox.y, docBBox.w, docBBox.h, 0, 0, crop.width, crop.height);

        // Resize if too large (for performance)
        const maxDim = 1600;
        let processedCanvas = crop;
        if (crop.width > maxDim || crop.height > maxDim) {
          const scale = Math.min(maxDim / crop.width, maxDim / crop.height);
          const resized = document.createElement('canvas');
          resized.width = Math.round(crop.width * scale);
          resized.height = Math.round(crop.height * scale);
          const rctx = resized.getContext('2d');
          rctx.drawImage(crop, 0, 0, resized.width, resized.height);
          processedCanvas = resized;
        }

        // Use enhanced OCR with multiple preprocessing approaches
        const ocrResult = await enhancedOCR(processedCanvas, {
          languages: 'eng',
          useMultiplePreprocessing: true,
          confidenceThreshold: 30, // Lower threshold for real-time processing
          enableSpellCheck: true,
          maxRetries: 1 // Limit retries for real-time performance
        });

        if (ocrResult.success && ocrResult.text.length > 0) {
          // Validate the OCR result
          const validation = validateOCRResult(ocrResult);

          setOcrText(ocrResult.text);
          setOcrConfidence(ocrResult.confidence);
          setDetectionMethod(prev => `${prev}+${ocrResult.method}`);
          setProcessingStats({
            confidence: ocrResult.confidence,
            method: ocrResult.method,
            processingTime: ocrResult.metadata.processingTime,
            wordCount: ocrResult.metadata.totalAttempts,
            corrected: ocrResult.metadata.corrected,
            validation: validation
          });

          lastExtractHashRef.current = currentHash;

          // Notify parent components
          try {
            onTextExtracted?.(ocrResult.text);
          } catch (e) {
            console.warn('Error notifying text extracted:', e);
          }

          try {
            onSolutionGenerated?.(ocrResult.text);
          } catch (e) {
            console.warn('Error notifying solution generated:', e);
          }

          console.log('✅ OCR completed:', {
            text: ocrResult.text.substring(0, 100) + '...',
            confidence: ocrResult.confidence,
            method: ocrResult.method,
            validation: validation.isValid
          });

        } else {
          console.warn('⚠️ OCR failed or returned empty result');
          setOcrText('');
          setOcrConfidence(0);
        }

      } catch (err) {
        console.error('❌ Enhanced OCR failed:', err);
        setOcrText('');
        setOcrConfidence(0);
        setProcessingStats(null);
      } finally {
        setIsProcessing(false);
      }
    }, 1000); // Slightly longer debounce for better stability

    return () => {
      if (extractionTimerRef.current) {
        clearTimeout(extractionTimerRef.current);
        extractionTimerRef.current = null;
      }
    };
  }, [docBBox]);

  // Note: OCR/capture is automatic when a document bbox is detected

  return (
    <div className="relative w-full h-full">
      {/* Camera Preview Container */}
      <div className="relative w-full bg-gradient-to-br from-gray-900 to-black rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-30 camera-overlay bg-gradient-to-b from-black/70 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full camera-status-indicator"></div>
              <h1 className="text-white font-semibold text-lg">
                📄 Document Scanner
              </h1>
            </div>
            <div className="text-white/80 text-sm bg-black/30 px-3 py-1 rounded-full">
              {isLoading ? '🔄 Loading...' : '✨ Ready'}
            </div>
          </div>
          <p className="text-white/70 text-sm mt-2">
            {isLoading ? 'Initializing AI model...' : 'Position a document in the camera view for automatic scanning'}
          </p>
        </div>

        {/* Camera View */}
        <div className="relative w-full aspect-[4/3] bg-black">
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored={cameraMode === 'user'}
            videoConstraints={selectedDeviceId ? { deviceId: selectedDeviceId } : { facingMode: cameraMode }}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ zIndex: 10 }}
          />

          {/* Overlay Canvas for Document Detection */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 12 }}
          />

          {/* Camera Controls Overlay */}
          <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center justify-between">
            {/* Camera Switch Button */}
            <button
              onClick={() => setCameraMode(prev => prev === 'user' ? 'environment' : 'user')}
              className="camera-overlay camera-button-hover bg-white/20 text-white px-4 py-2 rounded-full border border-white/30 hover:bg-white/30 transition-all duration-200 shadow-lg"
              disabled={isLoading}
            >
              <span className="flex items-center gap-2">
                🔄 {cameraMode === 'user' ? 'Switch to Rear' : 'Switch to Front'}
              </span>
            </button>

            {/* Enhanced Status Indicator */}
            <div className="camera-overlay bg-black/50 text-white px-4 py-2 rounded-full text-sm border border-white/20">
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  🔍 Processing OCR...
                </span>
              ) : docBBox ? (
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  ✅ Doc Found
                  {ocrConfidence > 0 && (
                    <span className="text-xs bg-green-500/20 px-2 py-1 rounded">
                      {ocrConfidence}% confident
                    </span>
                  )}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                  🔍 Searching...
                </span>
              )}
            </div>
          </div>

          {/* Loading Overlay */}
          {isLoading && (
            <div className="absolute inset-0 camera-overlay bg-black/90 flex items-center justify-center z-25">
              <div className="text-center text-white">
                <div className="relative">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/20 border-t-white mx-auto mb-4"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-2xl">🤖</div>
                  </div>
                </div>
                <p className="text-xl font-medium mb-2">Loading AI Model</p>
                <p className="text-sm text-white/70">Preparing document detection...</p>
                <div className="mt-4 flex justify-center space-x-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Extracted Text Panel */}
        <div className="bg-gradient-to-r from-gray-800 via-gray-900 to-gray-800 p-4 border-t border-gray-700/50">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-medium flex items-center gap-2">
              📝 Extracted Text
              {isProcessing && <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>}
            </h4>
            <div className="flex items-center gap-2">
              {/* Confidence Badge */}
              {ocrConfidence > 0 && (
                <div className={`text-xs px-2 py-1 rounded-full border ${
                  ocrConfidence >= 80 ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                  ocrConfidence >= 60 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' :
                  'bg-red-500/20 text-red-400 border-red-500/30'
                }`}>
                  {ocrConfidence}% confident
                </div>
              )}

              {/* Character Count */}
              <div className="text-xs text-gray-400 bg-gray-700/50 px-3 py-1 rounded-full border border-gray-600">
                {isProcessing ? (
                  <span className="flex items-center gap-1">
                    <div className="w-1 h-1 bg-yellow-400 rounded-full animate-pulse"></div>
                    Processing...
                  </span>
                ) : ocrText ? (
                  <span className="text-green-400">{ocrText.length} chars</span>
                ) : (
                  <span className="text-gray-500">Waiting</span>
                )}
              </div>
            </div>
          </div>

          {/* Processing Stats */}
          {processingStats && (
            <div className="mb-3 text-xs text-gray-400 flex items-center gap-4">
              <span>Method: {processingStats.method}</span>
              <span>Time: {processingStats.processingTime}ms</span>
              {processingStats.corrected && <span className="text-blue-400">✨ Spell-checked</span>}
            </div>
          )}

          <div className="bg-gray-900/70 rounded-xl p-4 min-h-[100px] max-h-40 overflow-y-auto border border-gray-700/50">
            <div className="text-sm text-gray-200 break-words whitespace-pre-wrap leading-relaxed">
              {ocrText ? (
                <span className="text-gray-100">{ocrText}</span>
              ) : (
                <span className="text-gray-500 italic flex items-center gap-2">
                  <div className="text-lg">👁️</div>
                  No text detected yet. Position a document clearly in the camera view for automatic scanning.
                </span>
              )}
            </div>
          </div>

          {/* Detection Method Info */}
          {detectionMethod && detectionMethod !== 'none' && (
            <div className="mt-2 text-xs text-gray-500 flex items-center gap-2">
              <span>🔍 Detection: {detectionMethod}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileCamera;
