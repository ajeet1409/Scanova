import { useEffect, useRef, useState, useCallback } from "react";
import Webcam from "react-webcam";
import { detectDocument } from "../utils/documentDetection.js";
import { enhancedOCR, validateOCRResult } from "../utils/enhancedOCR.js";

const MobileCamera = ({ onTextExtracted, onSolutionGenerated }) => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null); // overlay canvas
  const tmpCanvasRef = useRef(document.createElement("canvas")); // offscreen
  const fileInputRef = useRef(null); // hidden file input for mobile upload

  // default to rear camera
  const [cameraMode, setCameraMode] = useState("environment");
  const [isLoading] = useState(false);
  const [docBBox, setDocBBox] = useState(null); // {x,y,w,h}
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [ocrText, setOcrText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [detectionMethod, setDetectionMethod] = useState("");
  const [processingStats, setProcessingStats] = useState(null);
  const lastExtractHashRef = useRef(null);
  const extractionTimerRef = useRef(null);

  // TensorFlow COCO-SSD removed; using Python backend for detection
  const textScanTimerRef = useRef(null);


  // Throttling and backoff refs for stability
  const lastDetectTimeRef = useRef(0);
  const pyInFlightRef = useRef(false);
  const pyLastCallRef = useRef(0);
  const pyBackoffUntilRef = useRef(0);

  // Performance knobs
  const DETECT_OCR_TIMEOUT_MS = 4000; // hard cap per OCR/detect call

  // Helpers
  const withTimeout = useCallback(async (promise, ms, fallback = null) => {
    let timeoutId;
    try {
      return await Promise.race([
        promise,
        new Promise((resolve) => {
          timeoutId = setTimeout(() => resolve(fallback), ms);
        })
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }, []);

  const fetchWithTimeout = useCallback(async (url, options = {}, timeoutMs = DETECT_OCR_TIMEOUT_MS) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  }, []);

  // Enhanced overlay drawing with better visual feedback
  const drawOverlay = useCallback((bbox, score, label) => {
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
  }, [isProcessing]);

  // Capture current frame to an offscreen canvas and return it
  const captureFrameCanvas = useCallback(() => {
    const video = webcamRef.current?.video;
    if (!video) return null;
    const vw = video.videoWidth | 0;
    const vh = video.videoHeight | 0;
    if (vw <= 0 || vh <= 0) return null;
    const c = tmpCanvasRef.current;
    c.width = vw;
    c.height = vh;
    const ctx = c.getContext('2d');
    ctx.drawImage(video, 0, 0, vw, vh);
    return c;
  }, []);

  // Simple and robust edge-based document detection (fallback method)
  const findDocumentByEdges = useCallback((canvas) => {
    try {
      const w = canvas.width;
      const h = canvas.height;

      // Validate canvas dimensions
      if (w <= 0 || h <= 0 || w > 4000 || h > 4000) {
        console.warn('Invalid canvas dimensions for edge detection:', { w, h });
        return null;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.warn('Could not get canvas context');
        return null;
      }

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
  }, []);
  // Call Python FastAPI object detection (YOLO) and map to bbox
  const pyDetectObjects = useCallback(async (canvas) => {
    const originalW = canvas.width;
    const originalH = canvas.height;

    // Downscale for bandwidth/perf
    const maxW = 480;
    const scale = Math.min(1, maxW / originalW);
    let sendCanvas = canvas;
    if (scale < 1) {
      const dw = Math.max(1, Math.round(originalW * scale));
      const dh = Math.max(1, Math.round(originalH * scale));
      const off = document.createElement('canvas');
      off.width = dw; off.height = dh;
      const octx = off.getContext('2d');
      octx.drawImage(canvas, 0, 0, dw, dh);
      sendCanvas = off;
    }

    const blob = await new Promise(resolve => sendCanvas.toBlob(resolve, 'image/jpeg', 0.8));
    const form = new FormData();
    form.append('image', blob, 'frame.jpg');

    const PY_URL = 'http://127.0.0.1:8001/detect?imgsz=384&conf=0.25';
    const res = await fetchWithTimeout(PY_URL, { method: 'POST', body: form }, DETECT_OCR_TIMEOUT_MS);
    if (!res || !res.ok) throw new Error(`Python service error: ${res ? res.status : 'timeout'}`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.detections) || data.detections.length === 0) return null;

    // Prefer document-like classes; fall back to largest box
    const preferred = ['book','paper','document','notebook','magazine','laptop','cell phone','tv'];
    const dets = data.detections;
    const candidates = dets.filter(d => preferred.includes(String(d.label).toLowerCase()));
    const pool = candidates.length > 0 ? candidates : dets;

    // Pick largest area
    const best = pool.reduce((a, b) => (a.width * a.height > b.width * b.height) ? a : b);

    const inv = scale === 0 ? 1 : (1 / scale);
    const x = Math.max(0, Math.round(best.x * inv));
    const y = Math.max(0, Math.round(best.y * inv));
    const w = Math.round(best.width * inv);
    const h = Math.round(best.height * inv);

    // Basic sanity check
    if (w < originalW * 0.08 || h < originalH * 0.08) return null;

    return { x, y, w, h, confidence: best.score ?? 0.5, class: best.label || 'object' };
  }, [fetchWithTimeout, DETECT_OCR_TIMEOUT_MS]);

  // Upload: send selected image to Python /detect_ocr and display result
  const pyDetectAndOCRFile = useCallback(async (file) => {
    if (!file) return;
    setIsProcessing(true);
      setOcrText(prev => prev || 'Analyzing...');
      setDetectionMethod('upload-processing');
    try {
      const form = new FormData();
      form.append('image', file, file.name || 'upload.jpg');
      const url = 'http://127.0.0.1:8001/detect_ocr?conf=0.3&preferred_only=true&max_results=1';
      const res = await fetchWithTimeout(url, { method: 'POST', body: form }, DETECT_OCR_TIMEOUT_MS);
      if (res && res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.detections) && data.detections.length > 0) {
          const best = data.detections.reduce((a, b) => ((a?.text?.length || 0) > (b?.text?.length || 0) ? a : b));
          const combinedText = data.detections.map(d => d.text).filter(Boolean).join('\n').trim() || best?.text || '';
          if (combinedText) {
            setOcrText(combinedText);
            setOcrConfidence(Math.round((best?.score || 0) * 100));
            setDetectionMethod(`upload-ocr-${data?.detector || 'py'}`);
            setDocBBox(null); // avoid misaligned border on live camera
            onTextExtracted?.(combinedText);
            onSolutionGenerated?.(combinedText);
            return;
          }
        }
      }
      // Fallback: run local enhanced OCR on the uploaded image
      try {
        const bmp = await createImageBitmap(file);
        const c = tmpCanvasRef.current;
        const maxW = 1280;
        const scale = Math.min(1, maxW / (bmp.width || maxW));
        c.width = Math.max(1, Math.round(bmp.width * scale));
        c.height = Math.max(1, Math.round(bmp.height * scale));
        const ctx = c.getContext('2d');
        ctx.drawImage(bmp, 0, 0, c.width, c.height);
        const ocrResult = await withTimeout(enhancedOCR(c, { fast: true, useMultiplePreprocessing: false, confidenceThreshold: 25, enableSpellCheck: false }), DETECT_OCR_TIMEOUT_MS, { success: false, text: '', confidence: 0 });
        if (ocrResult?.success && ocrResult.text) {
          setOcrText(ocrResult.text);
          setOcrConfidence(Math.round(ocrResult.confidence || 0));
          setDetectionMethod('upload-local-ocr');
          setDocBBox(null);
          onTextExtracted?.(ocrResult.text);
          onSolutionGenerated?.(ocrResult.text);
        }
      } catch (e) {
        console.warn('Local OCR fallback failed:', e);
      }
    } catch (e) {
      console.warn('Upload detect+ocr failed:', e);
    } finally {
      setIsProcessing(false);
    }
  }, [onTextExtracted, onSolutionGenerated, fetchWithTimeout, withTimeout, DETECT_OCR_TIMEOUT_MS]);

  const handleOpenPicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e) => {
    const file = e.target?.files?.[0];
    if (file) {
      await pyDetectAndOCRFile(file);
      // reset input so selecting same file again still triggers change
      e.target.value = '';
    }
  }, [pyDetectAndOCRFile]);

  // Quick text scan when no document is detected
  const quickTextScan = useCallback(async () => {
    if (isProcessing) return;
    try {
      setIsProcessing(true);
      setOcrConfidence(0);
      setProcessingStats(null);
      setOcrText(prev => prev || 'Analyzing...');
      setDetectionMethod('text-scan-processing');
      const frame = captureFrameCanvas();
      if (!frame) return;
      // Downscale for performance
      const maxDim = 900;
      let processedCanvas = frame;
      if (frame.width > maxDim || frame.height > maxDim) {
        const scale = Math.min(maxDim / frame.width, maxDim / frame.height);
        const resized = document.createElement('canvas');
        resized.width = Math.round(frame.width * scale);
        resized.height = Math.round(frame.height * scale);
        resized.getContext('2d').drawImage(frame, 0, 0, resized.width, resized.height);
        processedCanvas = resized;
      }
      const ocrResult = await withTimeout(
        enhancedOCR(processedCanvas, {
          languages: 'eng', fast: true, useMultiplePreprocessing: false,
          confidenceThreshold: 25, enableSpellCheck: false
        }),
        DETECT_OCR_TIMEOUT_MS,
        { success: false, text: '', confidence: 0 }
      );
      if (ocrResult.success && ocrResult.text.length > 0) {
        setOcrText(ocrResult.text);
        setOcrConfidence(ocrResult.confidence);
        setDetectionMethod(`text-only+${ocrResult.method}`);
        setProcessingStats({
          confidence: ocrResult.confidence,
          method: ocrResult.method,
          processingTime: ocrResult.metadata.processingTime,
          wordCount: ocrResult.metadata.totalAttempts,
          corrected: ocrResult.metadata.corrected,
        });

        if (typeof onTextExtracted === 'function') onTextExtracted(ocrResult.text);
        if (typeof onSolutionGenerated === 'function') onSolutionGenerated(ocrResult.text);
      }
    } catch (err) {
      console.warn('Quick text scan failed:', err);
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, captureFrameCanvas, onTextExtracted, onSolutionGenerated, withTimeout, DETECT_OCR_TIMEOUT_MS]);


  // Enhanced detection loop using multiple approaches
  const detectLoop = useCallback(async () => {
    if (!webcamRef.current || !webcamRef.current.video) return;
    const video = webcamRef.current.video;
    if (video.readyState !== 4) return;

    const videoW = video.videoWidth;
    const videoH = video.videoHeight;

	    // Throttle overall detection loop to reduce CPU/memory pressure
	    const nowTs = Date.now();
	    if (nowTs - lastDetectTimeRef.current < 120) return; // run heavy steps ~8 fps
	    lastDetectTimeRef.current = nowTs;

    let detectedDoc = null;
    let method = 'none';

    try {
      // Fast path: quick downscaled detection for instant hover feedback
      {
        const frameFast = captureFrameCanvas();
        if (frameFast && frameFast.width > 0 && frameFast.height > 0) {
          try {
            const quickDoc = detectDocument(frameFast, {
              fast: true,
              combineResults: false,
              minArea: Math.max(600, (videoW * videoH) * 0.03), // smaller threshold for quick pass
              cannyLow: 60,

              cannyHigh: 140
            });
            if (quickDoc && quickDoc.score > 0.35) {
              const bb = quickDoc.boundingBox;
              detectedDoc = {
                x: Math.max(0, bb.x),
                y: Math.max(0, bb.y),
                w: Math.min(videoW - bb.x, bb.width),
                h: Math.min(videoH - bb.y, bb.height),
                confidence: quickDoc.score,
                class: 'document'
              };
              method = 'fast';
              // Draw overlay immediately for responsive UI
              drawOverlay(detectedDoc, detectedDoc.confidence, detectedDoc.class);
              // If very confident, skip heavier methods
              if (detectedDoc.confidence >= 0.7) {
                setDocBBox(detectedDoc);
                setDetectionMethod(method);
                return;
              }
            }
          } catch {
            // ignore quick detection errors; continue to other methods
          }
        }
      }

      // Method 1: Python backend detection (YOLO via FastAPI)
      {
        const frame = captureFrameCanvas();
        const now = Date.now();
        const canCallPy = now > pyBackoffUntilRef.current &&
                          !pyInFlightRef.current &&
                          (now - pyLastCallRef.current) > 600;
        if (canCallPy && frame && frame.width > 0 && frame.height > 0) {
          pyInFlightRef.current = true;
          try {
            const pyDoc = await pyDetectObjects(frame);
            if (pyDoc) {
              detectedDoc = pyDoc;
              method = `python-${pyDoc.class || 'object'}`;
            }
            pyLastCallRef.current = Date.now();
          } catch (err) {
            console.warn('Python detection failed:', err);
            pyBackoffUntilRef.current = Date.now() + 2000; // back off for 2s on error
          } finally {
            pyInFlightRef.current = false;
          }
        }
      }

      // Method 2: Enhanced document detection (if COCO-SSD didn't find anything good)
      if (!detectedDoc || detectedDoc.confidence < 0.6) {
        const frame = captureFrameCanvas();
        if (frame && frame.width > 0 && frame.height > 0) {
          try {
            const enhancedDoc = detectDocument(frame, {
              minArea: Math.max(1000, (videoW * videoH) * 0.05), // At least 5% of frame
              cannyLow: 50,
              cannyHigh: 150,
              useAdaptiveThreshold: true,
              combineResults: true
            });

            if (enhancedDoc && enhancedDoc.score > 0.3) {
              const bbox = enhancedDoc.boundingBox;
              if (bbox && bbox.width > 0 && bbox.height > 0) {
                const newDoc = {
                  x: Math.max(0, bbox.x),
                  y: Math.max(0, bbox.y),
                  w: Math.min(videoW, bbox.width),
                  h: Math.min(videoH, bbox.height),
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
          } catch (enhancedError) {
            console.warn('Enhanced document detection failed:', enhancedError);
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

      // Fallback to simple edge detection if enhanced methods fail
      try {
        const frame = captureFrameCanvas();
        if (frame) {
          const fallbackDoc = findDocumentByEdges(frame);
          if (fallbackDoc) {
            setDocBBox(fallbackDoc);
            setDetectionMethod('fallback-edge');
            drawOverlay(fallbackDoc, 0.5, 'Fallback');
          }
        }
      } catch (fallbackError) {
        console.error('Fallback detection also failed:', fallbackError);
        setDocBBox(null);
        setDetectionMethod('failed');
      }
    }
  }, [drawOverlay, captureFrameCanvas, findDocumentByEdges, pyDetectObjects]);

  // Run continuous detection using requestAnimationFrame loop
  useEffect(() => {
    let raf = 0;
    const loop = async () => {
      await detectLoop();
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [detectLoop]);

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

  // Removed TensorFlow model initialization

  // Default to rear camera on mobile devices
  useEffect(() => {
    try {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
      const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
      if (isMobile) {
        setCameraMode('environment');
      }
    } catch {
      // Ignore errors in mobile detection
    }
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
        } catch {
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


        setOcrText(prev => prev || 'Analyzing...');
        setDetectionMethod('doc-ocr-processing');
        // Capture and crop the document region
        const frame = captureFrameCanvas();
        if (!frame) return;

        const crop = document.createElement('canvas');
        crop.width = Math.max(1, Math.round(docBBox.w));
        crop.height = Math.max(1, Math.round(docBBox.h));
        const cctx = crop.getContext('2d');
        cctx.drawImage(frame, docBBox.x, docBBox.y, docBBox.w, docBBox.h, 0, 0, crop.width, crop.height);

        // Resize if too large (for performance)
        const maxDim = 1200;
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

        // Fast OCR with timeout
        const ocrResult = await withTimeout(
          enhancedOCR(processedCanvas, {
            languages: 'eng',
            fast: true,
            useMultiplePreprocessing: false,
            confidenceThreshold: 30,
            enableSpellCheck: false
          }),
          DETECT_OCR_TIMEOUT_MS,
          { success: false, text: '', confidence: 0 }
        );

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
    }, 350); // Faster debounce for quicker text extraction

    return () => {
      if (extractionTimerRef.current) {
        clearTimeout(extractionTimerRef.current);
        extractionTimerRef.current = null;
      }
    };
  }, [docBBox, captureFrameCanvas, onTextExtracted, onSolutionGenerated, withTimeout, DETECT_OCR_TIMEOUT_MS]);

  // Fallback: if no document bbox, periodically run a quick text-only scan
  useEffect(() => {
    if (textScanTimerRef.current) {
      clearTimeout(textScanTimerRef.current);
      textScanTimerRef.current = null;
    }
    if (docBBox) return; // document present; normal OCR flow handles it

    textScanTimerRef.current = setTimeout(() => {
      quickTextScan();
    }, 700);

    return () => {
      if (textScanTimerRef.current) {
        clearTimeout(textScanTimerRef.current);
        textScanTimerRef.current = null;
      }
    };
  }, [docBBox, quickTextScan]);


  // Note: OCR/capture is automatic when a document bbox is detected

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black">
      {/* Camera Preview Container */}
      <div className="absolute inset-0 overflow-hidden">
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

        {/* Small status badge (mode/time) */}
        <div className="absolute top-14 right-4 z-30 text-xs text-white/70 space-y-0.5">
          {detectionMethod && <div className="bg-black/40 px-2 py-1 rounded border border-white/10">Mode: {detectionMethod}</div>}
          {processingStats?.processingTime != null && (
            <div className="bg-black/40 px-2 py-1 rounded border border-white/10">Time: {processingStats.processingTime}ms</div>
          )}
        </div>


        {/* Camera View */}
        <div className="absolute inset-0 bg-black">
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


          {/* Inline Solution/Text Overlay */}
          <div className="absolute top-20 left-4 right-4 z-40 pointer-events-none">
            {ocrText && (
              <div className="bg-black/60 backdrop-blur-sm text-white p-3 rounded-xl border border-white/20 max-h-[40vh] overflow-y-auto shadow-lg pointer-events-auto">
                <div className="flex items-center justify-between mb-2 text-xs text-white/70">
                  <span>Solution</span>
                  {ocrConfidence > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/20">
                      {ocrConfidence}%
                    </span>
                  )}
                </div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {ocrText}
                </div>
              </div>
            )}
          </div>

          {/* Camera Controls Overlay - Mobile Camera Style */}
          <div className="absolute bottom-6 left-4 right-4 z-20 flex items-center justify-between">
            {/* Flip Camera */}
            <button
              onClick={() => setCameraMode(prev => prev === 'user' ? 'environment' : 'user')}
              className="camera-overlay camera-button-hover bg-white/20 text-white px-4 py-2 rounded-full border border-white/30 hover:bg-white/30 transition-all duration-200 shadow-lg"
              disabled={isLoading}
            >
              <span className="flex items-center gap-2">🔄 {cameraMode === 'user' ? 'Rear' : 'Front'}</span>
            </button>

                {/* Upload from Gallery (Mobile/Web) */}
                <button
                  onClick={handleOpenPicker}
                  className="camera-overlay camera-button-hover bg-blue-500/80 text-white px-4 py-2 rounded-full border border-white/30 hover:bg-blue-500 transition-all duration-200 shadow-lg"
                  disabled={isLoading}
                >
                  <span className="flex items-center gap-2">📁 Upload</span>
                </button>


            {/* Shutter Button */}

          </div>

              {/* Hidden file input for uploads */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />


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

      </div>
    </div>
  );
};

export default MobileCamera;
