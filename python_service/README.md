# Fast YOLO8 Object Detection Service

A high-performance, simplified object detection service using YOLO8 with bounding box visualization.

## 🚀 Key Improvements

This new implementation provides significant improvements over the previous complex version:

- **Much Faster**: Removed complex MediaPipe, OpenCV fallbacks, and OCR logic
- **Simplified**: Clean YOLO8-only implementation 
- **Better Performance**: Optimized for speed and accuracy
- **Bounding Boxes**: Built-in visualization with colored bounding boxes
- **Clean API**: Simple, well-documented endpoints
- **Error Handling**: Robust error handling and timeouts

## 📋 Requirements

```
fastapi==0.115.0
uvicorn[standard]==0.34.0
ultralytics==8.3.39
pillow==10.4.0
numpy>=1.21.0
python-multipart>=0.0.6
```

## 🛠️ Installation

1. Navigate to the python service directory:
```bash
cd server/python_service
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the service:
```bash
python app.py
```

The service will start on `http://127.0.0.1:8001`

## 📡 API Endpoints

### Health Check
```
GET /health
```
Returns service status and model information.

### Object Detection
```
POST /detect
```
Fast object detection without image annotation.

**Parameters:**
- `image`: Image file (multipart/form-data)
- `conf`: Confidence threshold (0.05-0.95, default: 0.25)
- `imgsz`: Image size for inference (256-1280, default: 640)
- `max_det`: Maximum detections (1-1000, default: 100)

**Response:**
```json
{
  "success": true,
  "detections": [
    {
      "x": 100.5,
      "y": 200.3,
      "width": 150.2,
      "height": 300.1,
      "score": 0.85,
      "label": "person",
      "nx": 0.1,
      "ny": 0.2,
      "nwidth": 0.15,
      "nheight": 0.3
    }
  ],
  "image_width": 1000,
  "image_height": 1000,
  "processing_time_ms": 45.2
}
```

### Object Detection with Bounding Boxes
```
POST /detect_with_image
```
Object detection with annotated image containing bounding boxes.

**Parameters:** Same as `/detect`

**Response:** Same as `/detect` plus:
```json
{
  "annotated_image_base64": "base64_encoded_image_with_bounding_boxes"
}
```

## 🧪 Testing

Run the test script to verify the implementation:

```bash
python test_yolo.py
```

This will test:
- Health endpoint
- Basic object detection
- Detection with bounding box visualization
- Performance benchmarking

## 🎯 Performance

The new implementation is significantly faster than the previous version:

- **Removed complexity**: No MediaPipe, OpenCV fallbacks, or OCR processing
- **Direct YOLO8**: Uses only YOLO8 for object detection
- **Optimized processing**: Streamlined image processing pipeline
- **Concurrent requests**: Supports multiple concurrent requests with semaphore control

Typical processing times:
- Small images (384px): ~50-100ms
- Medium images (640px): ~100-200ms
- Large images (1280px): ~200-400ms

## 🔧 Configuration

The service can be configured by modifying the following in `app.py`:

- **Model**: Change `yolov8n.pt` to other YOLO8 variants (s, m, l, x)
- **Concurrency**: Adjust `_infer_semaphore` value
- **Port**: Change the port in the `uvicorn.run()` call
- **CORS**: Modify CORS settings for production deployment

## 🐛 Troubleshooting

### Model Download Issues
If YOLO8 model download fails:
```bash
# Pre-download the model
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
```

### Memory Issues
For low-memory systems:
- Use smaller image sizes (`imgsz=384`)
- Reduce `max_det` parameter
- Use `yolov8n.pt` (nano) model

### Performance Issues
- Ensure GPU is available for faster inference
- Reduce image size for faster processing
- Adjust confidence threshold to reduce detections

## 🔄 Migration from Old Implementation

The new service is backward compatible with the existing client code. The `/detect` endpoint maintains the same response format, so no client changes are required.

Key differences:
- Removed `/detect_ocr` endpoint (OCR functionality removed)
- Added `/detect_with_image` for bounding box visualization
- Simplified response format (removed OCR-related fields)
- Much faster processing times

## 📈 Monitoring

Monitor the service performance:
- Check processing times in response
- Monitor memory usage
- Watch for timeout errors
- Verify model loading success in logs
