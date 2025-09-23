from fastapi import FastAPI, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from io import BytesIO
from PIL import Image, ImageOps
import asyncio
import uvicorn
import os
import math
import numpy as np

# Optional dependencies: OpenCV, MediaPipe, OCR backends
try:
    import cv2
except Exception:
    cv2 = None

# MediaPipe Tasks (Object Detector)
MP_AVAILABLE = False
try:
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision
    from mediapipe.tasks.python.core.base_options import BaseOptions
    MP_AVAILABLE = True
except Exception:
    MP_AVAILABLE = False

# OCR backends: EasyOCR preferred (no system Tesseract); fallback to pytesseract if available
OCR_BACKEND = None
_easyocr_reader = None
try:
    import easyocr
    _easyocr_reader = easyocr.Reader(['en'], gpu=False)
    OCR_BACKEND = 'easyocr'
except Exception:
    try:
        import pytesseract  # requires system Tesseract installed
        OCR_BACKEND = 'pytesseract'
    except Exception:
        OCR_BACKEND = None


# Load model (YOLOv8) once at startup
try:
    from ultralytics import YOLO
    _model = YOLO("yolov8n.pt")  # downloads weights on first run
    MODEL_OK = True
    MODEL_NAMES = _model.model.names if hasattr(_model, 'model') else _model.names
except Exception:
    _model = None
    MODEL_OK = False
    MODEL_NAMES = {}

# Simple concurrency guard to avoid overloading CPU on mobile usage
_infer_semaphore = asyncio.Semaphore(1)

app = FastAPI(title="Object Detection Service", version="1.1")

# Allow local dev origins; adjust for production
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# -------- MediaPipe detector and OCR helpers --------
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
MP_MODEL_PATH = os.path.join(MODEL_DIR, "efficientdet_lite0.tflite")
MP_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float32/latest/efficientdet_lite0.tflite"

_mp_detector = None

def _ensure_mp_model():
    if not MP_AVAILABLE:
        return False
    os.makedirs(MODEL_DIR, exist_ok=True)
    if not os.path.exists(MP_MODEL_PATH):
        try:
            import urllib.request
            urllib.request.urlretrieve(MP_MODEL_URL, MP_MODEL_PATH)
        except Exception:
            return False
    return True

def _init_mp_detector():
    global _mp_detector
    if not MP_AVAILABLE:
        return None
    if _mp_detector is not None:
        return _mp_detector
    if not _ensure_mp_model():
        return None
    try:
        base_opts = BaseOptions(model_asset_path=MP_MODEL_PATH)
        det_opts = mp_vision.ObjectDetectorOptions(
            base_options=base_opts,
            score_threshold=0.3,
            max_results=5,
        )
        _mp_detector = mp_vision.ObjectDetector.create_from_options(det_opts)
        return _mp_detector
    except Exception:
        _mp_detector = None
        return None

# Preprocess ROI for OCR using OpenCV if available
def _preprocess_for_ocr(np_rgb_roi):
    if cv2 is None:
        return np_rgb_roi
    img = cv2.cvtColor(np_rgb_roi, cv2.COLOR_RGB2GRAY)
    img = cv2.bilateralFilter(img, 5, 75, 75)
    try:
        # Adaptive threshold for uneven lighting
        th = cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                   cv2.THRESH_BINARY, 15, 8)
    except Exception:
        # Fallback to Otsu
        _, th = cv2.threshold(img, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    # Morph open to remove small noise
    kernel = np.ones((2, 2), np.uint8)
    th = cv2.morphologyEx(th, cv2.MORPH_OPEN, kernel, iterations=1)
    return cv2.cvtColor(th, cv2.COLOR_GRAY2RGB)

# Run OCR on numpy RGB ROI
def _run_ocr(np_rgb_roi):
    if OCR_BACKEND == 'easyocr' and _easyocr_reader is not None:
        try:
            # easyocr expects RGB image array
            result = _easyocr_reader.readtext(np_rgb_roi, detail=0, paragraph=True)
            text = "\n".join([t.strip() for t in result if isinstance(t, str)]).strip()
            return text, 0.0
        except Exception:
            pass
    if OCR_BACKEND == 'pytesseract':
        try:
            import pytesseract
            # pytesseract expects RGB; provide config for speed
            text = pytesseract.image_to_string(np_rgb_roi, config='--oem 1 --psm 6')
            return text.strip(), 0.0
        except Exception:
            pass
    return "", 0.0

# Simple OpenCV fallback: find largest contour's bounding rect
def _cv_fallback_detect(np_rgb):
    if cv2 is None:
        return []
    gray = cv2.cvtColor(np_rgb, cv2.COLOR_RGB2GRAY)
    gray = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(gray, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return []
    c = max(contours, key=cv2.contourArea)
    x, y, w, h = cv2.boundingRect(c)
    if w * h < (np_rgb.shape[0] * np_rgb.shape[1]) * 0.02:
        return []
    return [(x, y, w, h, 0.4, 'region')]



class Detection(BaseModel):
    # Pixel coordinates (relative to the received image)
    x: float
    y: float
    width: float
    height: float
    score: float
    label: str
    # Normalized coordinates in [0,1] (added for mobile layout convenience)
    nx: Optional[float] = None
    ny: Optional[float] = None
    nwidth: Optional[float] = None
    nheight: Optional[float] = None


class DetectResponse(BaseModel):
    success: bool
    detections: List[Detection] = []
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    error: Optional[str] = None


@app.get("/health")
async def health():
    return {"ok": True, "model": MODEL_OK, "classes": len(MODEL_NAMES) if isinstance(MODEL_NAMES, dict) else 0}


@app.post("/detect", response_model=DetectResponse)
async def detect(
    image: UploadFile = File(...),
    conf: float = Query(0.25, ge=0.05, le=0.9),
    imgsz: int = Query(640, ge=256, le=1280),
    preferred_only: bool = Query(False, description="Return only document-like classes"),
    normalized: bool = Query(True, description="Include normalized coordinates in response"),
):
    if not MODEL_OK:
        return DetectResponse(success=False, detections=[], error="Model not available")

    # Serialize inferences to keep CPU/GPU from being flooded
    async with _infer_semaphore:
        try:
            data = await image.read()
            # Auto-orient image using EXIF (common in mobile uploads)
            img = Image.open(BytesIO(data)).convert("RGB")
            img = ImageOps.exif_transpose(img)
            W, H = img.size

            # Run inference
            results = _model.predict(source=img, imgsz=imgsz, conf=conf, verbose=False)
            res = results[0]
            dets: List[Detection] = []

            preferred = {"book", "paper", "document", "notebook", "magazine", "laptop", "cell phone", "tv"}

            if hasattr(res, 'boxes') and res.boxes is not None:
                for b in res.boxes:
                    xyxy = b.xyxy[0].tolist()
                    x1, y1, x2, y2 = xyxy
                    confv = float(b.conf[0]) if hasattr(b, 'conf') else 0.0
                    cls_id = int(b.cls[0]) if hasattr(b, 'cls') else -1
                    label = MODEL_NAMES.get(cls_id, str(cls_id)) if isinstance(MODEL_NAMES, dict) else str(cls_id)

                    # Filter if requested
                    if preferred_only and label.lower() not in preferred:
                        continue

                    px = float(x1)
                    py = float(y1)
                    pw = float(max(0.0, x2 - x1))
                    ph = float(max(0.0, y2 - y1))

                    det = Detection(
                        x=px, y=py, width=pw, height=ph,
                        score=confv, label=label,
                        nx=px / W if normalized else None,
                        ny=py / H if normalized else None,
                        nwidth=pw / W if normalized else None,
                        nheight=ph / H if normalized else None,
                    )
                    dets.append(det)

            return DetectResponse(success=True, detections=dets, image_width=W, image_height=H)
        except Exception as e:
            return DetectResponse(success=False, detections=[], error=str(e))

# ----- OCR-augmented detection using MediaPipe/OpenCV -----
class OcrDetection(Detection):
    text: str = ""
    ocr_score: float = 0.0

class DetectOcrResponse(BaseModel):
    success: bool
    detections: List[OcrDetection] = []
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    detector: Optional[str] = None
    ocr_backend: Optional[str] = None
    error: Optional[str] = None

@app.post("/detect_ocr", response_model=DetectOcrResponse)
async def detect_ocr(
    image: UploadFile = File(...),
    conf: float = Query(0.30, ge=0.05, le=0.95),
    preferred_only: bool = Query(True, description="Return only document-like classes"),
    max_results: int = Query(1, ge=1, le=10),
):
    async with _infer_semaphore:
        try:
            data = await image.read()
            pil = ImageOps.exif_transpose(Image.open(BytesIO(data)).convert("RGB"))
            W, H = pil.size
            np_rgb = np.array(pil)

            dets = []
            detector_used = None

            # Try MediaPipe Object Detector first
            mp_det = _init_mp_detector()
            preferred = {"book", "paper", "document", "notebook", "magazine", "laptop", "cell phone", "tv"}
            if mp_det is not None:
                try:
                    mp_image = mp_python.Image(image_format=mp_python.ImageFormat.SRGB, data=np_rgb)
                    mp_result = mp_det.detect(mp_image)
                    for d in getattr(mp_result, 'detections', []) or []:
                        # categories
                        label = d.categories[0].category_name if getattr(d, 'categories', None) else "object"
                        score = float(d.categories[0].score) if getattr(d, 'categories', None) else 0.0
                        if score < conf:
                            continue
                        if preferred_only and label.lower() not in preferred:
                            continue
                        bb = d.bounding_box
                        x, y = int(max(0, bb.origin_x)), int(max(0, bb.origin_y))
                        w, h = int(max(0, bb.width)), int(max(0, bb.height))
                        # clamp within image bounds
                        x2, y2 = min(W, x + w), min(H, y + h)
                        x, y = min(x, W - 1), min(y, H - 1)
                        w, h = max(0, x2 - x), max(0, y2 - y)
                        if w <= 2 or h <= 2:
                            continue
                        dets.append((x, y, w, h, score, label))
                    detector_used = "mediapipe"
                except Exception:
                    pass

            # Fallback to OpenCV contour-based region if nothing found
            if not dets:
                fb = _cv_fallback_detect(np_rgb)
                if fb:
                    dets.extend(fb)
                    detector_used = "opencv"

            # If still nothing, return gracefully
            if not dets:
                return DetectOcrResponse(success=True, detections=[], image_width=W, image_height=H,
                                         detector=detector_used, ocr_backend=OCR_BACKEND)

            # Sort by area desc and cap results
            dets.sort(key=lambda t: t[2] * t[3], reverse=True)
            dets = dets[:max_results]

            ocr_dets: List[OcrDetection] = []
            for (x, y, w, h, score, label) in dets:
                # crop ROI
                rx1, ry1 = int(x), int(y)
                rx2, ry2 = int(min(W, x + w)), int(min(H, y + h))
                if rx2 - rx1 <= 2 or ry2 - ry1 <= 2:
                    continue
                roi = np_rgb[ry1:ry2, rx1:rx2]
                # Cap ROI size for speed on low-end devices
                try:
                    max_dim = 1200
                    rh, rw = roi.shape[0], roi.shape[1]
                    scale = min(1.0, max_dim / max(rw, rh))
                    if scale < 1.0:
                        if cv2 is not None:
                            roi = cv2.resize(roi, (int(rw * scale), int(rh * scale)), interpolation=cv2.INTER_AREA)
                        else:
                            _pil_roi = Image.fromarray(roi)
                            new_w = max(1, int(rw * scale)); new_h = max(1, int(rh * scale))
                            _pil_roi = _pil_roi.resize((new_w, new_h), Image.BILINEAR)
                            roi = np.array(_pil_roi)
                except Exception:
                    pass

                roi_p = _preprocess_for_ocr(roi)
                text, ocr_score = _run_ocr(roi_p)

                ocr_dets.append(OcrDetection(
                    x=float(rx1), y=float(ry1), width=float(rx2 - rx1), height=float(ry2 - ry1),
                    score=float(score), label=str(label),
                    nx=rx1 / W, ny=ry1 / H, nwidth=(rx2 - rx1) / W, nheight=(ry2 - ry1) / H,
                    text=text, ocr_score=float(ocr_score),
                ))

            return DetectOcrResponse(success=True, detections=ocr_dets, image_width=W, image_height=H,
                                     detector=detector_used, ocr_backend=OCR_BACKEND)
        except Exception as e:
            return DetectOcrResponse(success=False, detections=[], error=str(e))



if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
