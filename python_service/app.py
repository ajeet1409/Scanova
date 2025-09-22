from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from io import BytesIO
from PIL import Image
import uvicorn

try:
    from ultralytics import YOLO
    _model = YOLO("yolov8n.pt")  # downloads weights on first run
    MODEL_OK = True
    MODEL_NAMES = _model.model.names if hasattr(_model, 'model') else _model.names
except Exception as e:
    # Allow server to start even if model fails (helpful for CI)
    _model = None
    MODEL_OK = False
    MODEL_NAMES = {}

app = FastAPI(title="Object Detection Service", version="1.0")

# Allow local dev origins; adjust as needed
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Detection(BaseModel):
    x: float
    y: float
    width: float
    height: float
    score: float
    label: str

class DetectResponse(BaseModel):
    success: bool
    detections: List[Detection] = []
    error: Optional[str] = None

@app.post("/detect", response_model=DetectResponse)
async def detect(image: UploadFile = File(...)):
    if not MODEL_OK:
        return DetectResponse(success=False, detections=[], error="Model not available")
    try:
        data = await image.read()
        img = Image.open(BytesIO(data)).convert("RGB")
        # Run inference (small input preferred for speed)
        results = _model.predict(source=img, imgsz=640, conf=0.25, verbose=False)
        res = results[0]
        dets: List[Detection] = []
        if hasattr(res, 'boxes') and res.boxes is not None:
            # xyxy in pixels
            for b in res.boxes:
                xyxy = b.xyxy[0].tolist()
                x1, y1, x2, y2 = xyxy
                conf = float(b.conf[0]) if hasattr(b, 'conf') else 0.0
                cls_id = int(b.cls[0]) if hasattr(b, 'cls') else -1
                label = MODEL_NAMES.get(cls_id, str(cls_id)) if isinstance(MODEL_NAMES, dict) else str(cls_id)
                dets.append(Detection(
                    x=float(x1), y=float(y1),
                    width=float(x2 - x1), height=float(y2 - y1),
                    score=conf, label=label
                ))
        return DetectResponse(success=True, detections=dets)
    except Exception as e:
        return DetectResponse(success=False, detections=[], error=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)

