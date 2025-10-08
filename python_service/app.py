from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from io import BytesIO
from PIL import Image, ImageOps, ImageDraw, ImageFont
import uvicorn
import numpy as np
import base64
import time
import asyncio

# Load YOLO model once at startup
try:
    from ultralytics import YOLO
    print("🚀 Loading YOLO8 model...")
    _model = YOLO("yolov8n.pt")  # downloads weights on first run
    MODEL_OK = True
    MODEL_NAMES = _model.model.names if hasattr(_model, 'model') else _model.names
    print(f"✅ YOLO8 model loaded successfully. Available classes: {len(MODEL_NAMES)}")
except Exception as e:
    print(f"❌ Failed to load YOLO model: {e}")
    _model = None
    MODEL_OK = False
    MODEL_NAMES = {}

# FastAPI app
app = FastAPI(title="Fast YOLO8 Object Detection Service", version="2.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Concurrency control
_infer_semaphore = asyncio.Semaphore(2)

# Data models
class Detection(BaseModel):
    x: float
    y: float
    width: float
    height: float
    score: float
    label: str
    # Normalized coordinates in [0,1]
    nx: Optional[float] = None
    ny: Optional[float] = None
    nwidth: Optional[float] = None
    nheight: Optional[float] = None

class DetectResponse(BaseModel):
    success: bool
    detections: List[Detection] = []
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    processing_time_ms: Optional[float] = None
    error: Optional[str] = None

class DetectWithImageResponse(BaseModel):
    success: bool
    detections: List[Detection] = []
    image_width: Optional[int] = None
    image_height: Optional[int] = None
    processing_time_ms: Optional[float] = None
    annotated_image_base64: Optional[str] = None
    error: Optional[str] = None

# Helper function to draw bounding boxes
def draw_bounding_boxes(image: Image.Image, detections: List[Detection]) -> Image.Image:
    """Draw bounding boxes on the image"""
    draw = ImageDraw.Draw(image)
    
    # Try to use a better font, fallback to default
    try:
        font = ImageFont.truetype("arial.ttf", 16)
    except:
        font = ImageFont.load_default()
    
    colors = [
        "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
        "#FFA500", "#800080", "#FFC0CB", "#A52A2A", "#808080", "#000080"
    ]
    
    for i, det in enumerate(detections):
        color = colors[i % len(colors)]
        
        # Draw bounding box
        x1, y1 = int(det.x), int(det.y)
        x2, y2 = int(det.x + det.width), int(det.y + det.height)
        
        # Draw rectangle
        draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
        
        # Draw label background
        label_text = f"{det.label}: {det.score:.2f}"
        bbox = draw.textbbox((x1, y1), label_text, font=font)
        draw.rectangle([bbox[0]-2, bbox[1]-2, bbox[2]+2, bbox[3]+2], fill=color)
        
        # Draw label text
        draw.text((x1, y1), label_text, fill="white", font=font)
    
    return image

# Health check endpoint
@app.get("/health")
async def health():
    return {
        "status": "ok", 
        "model_loaded": MODEL_OK, 
        "available_classes": len(MODEL_NAMES) if isinstance(MODEL_NAMES, dict) else 0,
        "service": "Fast YOLO8 Object Detection"
    }

# Fast object detection endpoint
@app.post("/detect", response_model=DetectResponse)
async def detect_objects(
    image: UploadFile = File(...),
    conf: float = Query(0.25, ge=0.05, le=0.95, description="Confidence threshold"),
    imgsz: int = Query(640, ge=256, le=1280, description="Image size for inference"),
    max_det: int = Query(100, ge=1, le=1000, description="Maximum detections")
):
    """Fast YOLO8 object detection without image annotation"""
    if not MODEL_OK:
        raise HTTPException(status_code=503, detail="YOLO model not available")
    
    async with _infer_semaphore:
        start_time = time.time()
        
        try:
            # Read and process image
            data = await image.read()
            img = Image.open(BytesIO(data)).convert("RGB")
            img = ImageOps.exif_transpose(img)  # Handle EXIF rotation
            W, H = img.size
            
            # Run YOLO inference
            results = _model.predict(
                source=img, 
                imgsz=imgsz, 
                conf=conf, 
                max_det=max_det,
                verbose=False
            )
            
            # Process results
            detections = []
            if results and len(results) > 0:
                result = results[0]
                if hasattr(result, 'boxes') and result.boxes is not None:
                    boxes = result.boxes
                    for i in range(len(boxes)):
                        # Get box coordinates (xyxy format)
                        box = boxes.xyxy[i].cpu().numpy()
                        conf_score = float(boxes.conf[i].cpu().numpy())
                        class_id = int(boxes.cls[i].cpu().numpy())
                        
                        # Convert to our format
                        x1, y1, x2, y2 = box
                        width = x2 - x1
                        height = y2 - y1
                        
                        # Get class name
                        label = MODEL_NAMES.get(class_id, f"class_{class_id}")
                        
                        detection = Detection(
                            x=float(x1),
                            y=float(y1),
                            width=float(width),
                            height=float(height),
                            score=conf_score,
                            label=label,
                            # Normalized coordinates
                            nx=float(x1 / W),
                            ny=float(y1 / H),
                            nwidth=float(width / W),
                            nheight=float(height / H)
                        )
                        detections.append(detection)
            
            processing_time = (time.time() - start_time) * 1000
            
            return DetectResponse(
                success=True,
                detections=detections,
                image_width=W,
                image_height=H,
                processing_time_ms=processing_time
            )
            
        except Exception as e:
            processing_time = (time.time() - start_time) * 1000
            return DetectResponse(
                success=False,
                detections=[],
                processing_time_ms=processing_time,
                error=str(e)
            )

# Object detection with annotated image
@app.post("/detect_with_image", response_model=DetectWithImageResponse)
async def detect_with_image(
    image: UploadFile = File(...),
    conf: float = Query(0.25, ge=0.05, le=0.95, description="Confidence threshold"),
    imgsz: int = Query(640, ge=256, le=1280, description="Image size for inference"),
    max_det: int = Query(100, ge=1, le=1000, description="Maximum detections")
):
    """YOLO8 object detection with bounding box visualization"""
    if not MODEL_OK:
        raise HTTPException(status_code=503, detail="YOLO model not available")
    
    async with _infer_semaphore:
        start_time = time.time()
        
        try:
            # Read and process image
            data = await image.read()
            img = Image.open(BytesIO(data)).convert("RGB")
            img = ImageOps.exif_transpose(img)  # Handle EXIF rotation
            W, H = img.size
            
            # Run YOLO inference
            results = _model.predict(
                source=img, 
                imgsz=imgsz, 
                conf=conf, 
                max_det=max_det,
                verbose=False
            )
            
            # Process results
            detections = []
            if results and len(results) > 0:
                result = results[0]
                if hasattr(result, 'boxes') and result.boxes is not None:
                    boxes = result.boxes
                    for i in range(len(boxes)):
                        # Get box coordinates (xyxy format)
                        box = boxes.xyxy[i].cpu().numpy()
                        conf_score = float(boxes.conf[i].cpu().numpy())
                        class_id = int(boxes.cls[i].cpu().numpy())
                        
                        # Convert to our format
                        x1, y1, x2, y2 = box
                        width = x2 - x1
                        height = y2 - y1
                        
                        # Get class name
                        label = MODEL_NAMES.get(class_id, f"class_{class_id}")
                        
                        detection = Detection(
                            x=float(x1),
                            y=float(y1),
                            width=float(width),
                            height=float(height),
                            score=conf_score,
                            label=label,
                            # Normalized coordinates
                            nx=float(x1 / W),
                            ny=float(y1 / H),
                            nwidth=float(width / W),
                            nheight=float(height / H)
                        )
                        detections.append(detection)
            
            # Draw bounding boxes on image
            annotated_img = draw_bounding_boxes(img.copy(), detections)
            
            # Convert to base64
            buffer = BytesIO()
            annotated_img.save(buffer, format="JPEG", quality=85)
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            processing_time = (time.time() - start_time) * 1000
            
            return DetectWithImageResponse(
                success=True,
                detections=detections,
                image_width=W,
                image_height=H,
                processing_time_ms=processing_time,
                annotated_image_base64=img_base64
            )
            
        except Exception as e:
            processing_time = (time.time() - start_time) * 1000
            return DetectWithImageResponse(
                success=False,
                detections=[],
                processing_time_ms=processing_time,
                error=str(e)
            )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
