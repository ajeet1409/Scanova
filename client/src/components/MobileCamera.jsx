import { useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";
import * as tf from "@tensorflow/tfjs";
import * as cocossd from "@tensorflow-models/coco-ssd";
import Tesseract from "tesseract.js";

const MobileCamera = () => {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null); // overlay canvas
  const tmpCanvasRef = useRef(document.createElement("canvas")); // offscreen

  const [cameraMode, setCameraMode] = useState("user");
  const [isLoading, setIsLoading] = useState(false);
  const [net, setNet] = useState(null);
  const [docBBox, setDocBBox] = useState(null); // {x,y,w,h}
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [ocrText, setOcrText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const lastExtractHashRef = useRef(null);
  const extractionTimerRef = useRef(null);

  // initialize coco-ssd model and TF backend
  const runCoco = async () => {
    try {
      setIsLoading(true);
      await tf.setBackend("webgl");
      await tf.ready();
      const model = await cocossd.load();
      setNet(model);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load model', err);
      setIsLoading(false);
    }
  };

  // Utility: draw overlay box
  const drawOverlay = (bbox, score, label) => {
    const canvas = canvasRef.current;
    const video = webcamRef.current?.video;
    if (!canvas || !video) return;
    // Set canvas to video intrinsic size (so drawing coordinates match video pixels)
    const ctx = canvas.getContext('2d');
    const vidW = video.videoWidth || video.clientWidth;
    const vidH = video.videoHeight || video.clientHeight;
    canvas.width = vidW;
    canvas.height = vidH;
    // ensure canvas CSS covers the container
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (bbox) {
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = Math.max(2, Math.round(4 * (canvas.width / 640)));
  ctx.strokeRect(bbox.x, bbox.y, bbox.w, bbox.h);

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(bbox.x, Math.max(0, bbox.y - 24), Math.min(200, bbox.w), 22);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText(`${label || 'Document'} ${Math.round((score||0)*100)}%`, bbox.x + 6, Math.max(16, bbox.y - 6));
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

  // Main detection loop: prefer model detections, fallback to edge detection
  const detectLoop = async () => {
    if (!webcamRef.current || !webcamRef.current.video) return;
    const video = webcamRef.current.video;
    if (video.readyState !== 4) return;

    const videoW = video.videoWidth;
    const videoH = video.videoHeight;

    // use model if loaded
    if (net) {
      try {
        const preds = await net.detect(video);
        // find document-like classes
        const paperPreds = preds.filter(p => {
          const cls = (p.class || '').toLowerCase();
          return ['book','paper','document','notebook','magazine'].some(k => cls.includes(k));
        });

        if (paperPreds.length > 0) {
          // select largest by area
          const best = paperPreds.reduce((a,b) => (a.bbox[2]*a.bbox[3] > b.bbox[2]*b.bbox[3]) ? a : b);
          const [x,y,w,h] = best.bbox;
          const bbox = { x: Math.max(0, x), y: Math.max(0, y), w: Math.min(videoW - x, w), h: Math.min(videoH - y, h) };
          setDocBBox(bbox);
          drawOverlay(bbox, best.score, best.class);
          return;
        }
      } catch (err) {
        console.error('Model detection failed', err);
      }
    }

    // fallback edge-based detection
    const frame = captureFrameCanvas();
    if (!frame) return;
    const edgeBox = findDocumentByEdges(frame);
    if (edgeBox) {
      setDocBBox(edgeBox);
      drawOverlay(edgeBox, 0, 'EdgeDetect');
    } else {
      setDocBBox(null);
      // clear overlay
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
      }
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

  const detect1 = async (net) => {
    try {
      if (
        webcamRef1.current &&
        webcamRef1.current.video &&
        webcamRef1.current.video.readyState === 4
      ) {
        const video = webcamRef1.current.video;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        video.width = videoWidth;
        video.height = videoHeight;
        canvasRef1.current.width = videoWidth;
        canvasRef1.current.height = videoHeight;

        const hands = await net.estimateHands(video);
        // console.log(hands)
        const ctx = canvasRef1.current.getContext("2d");
        drawHands(hands, ctx);
      }
    } catch (err) {
      console.error("Hand detection error:", err);
    }
  };

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
      // double-check bbox still exists
      if (!docBBox) return;
      const currentHash = `${Math.round(docBBox.x)}:${Math.round(docBBox.y)}:${Math.round(docBBox.w)}:${Math.round(docBBox.h)}`;
      if (lastExtractHashRef.current === currentHash) return;
      try {
        setIsProcessing(true);
        // capture and crop
        const frame = captureFrameCanvas();
        if (!frame) return;
        const crop = document.createElement('canvas');
        crop.width = Math.max(1, Math.round(docBBox.w));
        crop.height = Math.max(1, Math.round(docBBox.h));
        const cctx = crop.getContext('2d');
        cctx.drawImage(frame, docBBox.x, docBBox.y, docBBox.w, docBBox.h, 0, 0, crop.width, crop.height);

        // simple preprocessing: resize if big, convert to grayscale & stretch
        const maxDim = 1600;
        let proc = crop;
        if (proc.width > maxDim || proc.height > maxDim) {
          const scale = Math.min(maxDim / proc.width, maxDim / proc.height);
          const resized = document.createElement('canvas');
          resized.width = Math.round(proc.width * scale);
          resized.height = Math.round(proc.height * scale);
          const rctx = resized.getContext('2d');
          rctx.drawImage(proc, 0, 0, resized.width, resized.height);
          proc = resized;
        }

        const pctx = proc.getContext('2d');
        const imgd = pctx.getImageData(0,0,proc.width,proc.height);
        const d = imgd.data;
        let min=255, max=0;
        for (let i=0;i<d.length;i+=4){
          const g = (d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114)|0;
          if (g<min) min=g; if (g>max) max=g;
        }
        const range = Math.max(1, max-min);
        for (let i=0;i<d.length;i+=4){
          const g = (d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114)|0;
          const stretched = Math.min(255, Math.max(0, Math.round((g - min) * 255 / range)));
          d[i]=d[i+1]=d[i+2]=stretched;
        }
        pctx.putImageData(imgd,0,0);

        const blob = await new Promise(res => proc.toBlob(res, 'image/jpeg', 0.9));
        const { data: { text } } = await Tesseract.recognize(blob, 'eng', { logger: m => {} });
        setOcrText((text || '').trim());
        lastExtractHashRef.current = currentHash;
      } catch (err) {
        console.error('Auto OCR failed', err);
      } finally {
        setIsProcessing(false);
      }
    }, 800);

    return () => {
      if (extractionTimerRef.current) {
        clearTimeout(extractionTimerRef.current);
        extractionTimerRef.current = null;
      }
    };
  }, [docBBox]);

  // Note: OCR/capture removed — component now only shows preview + toggle

  return (
    <div>
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center gap-4 p-4">
        <h1 className={`text-2xl text-white font-bold mb-2`}>
          Document Scanner
        </h1>
        <p className="text-sm text-gray-200 mb-4">{isLoading ? 'Loading model...' : 'Point camera at a page or document'}</p>

  <div className="relative w-full max-w-md md:max-w-3xl bg-black rounded-lg overflow-hidden shadow-lg mx-auto" style={{aspectRatio: '4/3'}}>
          <Webcam
            ref={webcamRef}
            audio={false}
            mirrored={cameraMode === 'user'}
            videoConstraints={selectedDeviceId ? { deviceId: selectedDeviceId } : { facingMode: cameraMode }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              zIndex: 10,
              objectFit: 'cover',
              borderRadius: 'inherit'
            }}
          />

          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              zIndex: 12,
              pointerEvents: 'none'
            }}
          />
          {/* Mobile overlay toggle (inside preview) */}
          <button
            onClick={() => setCameraMode(prev => prev === 'user' ? 'environment' : 'user')}
            className="absolute bottom-3 right-3 z-20 bg-white bg-opacity-80 text-sm text-gray-800 px-3 py-2 rounded-full shadow"
            style={{backdropFilter: 'blur(6px)'}}
          >
            {cameraMode === 'user' ? 'Rear' : 'Front'}
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 mt-3 w-full max-w-md md:max-w-3xl">
          <button
            onClick={() => setCameraMode(prev => prev === 'user' ? 'environment' : 'user')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md"
            disabled={isLoading}
            style={{minWidth: 160}}
          >
            {cameraMode === 'user' ? 'Use Rear Camera' : 'Use Front Camera'}
          </button>

          <div className="text-sm text-gray-300">{isLoading ? 'Model loading...' : 'Preview active'}</div>
        </div>
        <div className="w-full max-w-md md:max-w-3xl mt-4 bg-white bg-opacity-80 dark:bg-black/60 p-3 rounded-lg shadow-inner">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Extracted Text</h4>
            <div className="text-xs text-gray-500">{isProcessing ? 'Scanning...' : (ocrText ? 'Done' : 'Waiting')}</div>
          </div>
          <div className="min-h-[60px] text-sm text-gray-800 dark:text-gray-200 break-words whitespace-pre-wrap">
            {ocrText || 'No text extracted yet. Point camera at a page.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileCamera;
