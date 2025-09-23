from fastapi import FastAPI, UploadFile, File, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from io import BytesIO
from PIL import Image, ImageOps
import asyncio
import uvicorn

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


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
