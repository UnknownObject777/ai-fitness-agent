import base64
import re
import time
from secrets import token_hex

from fastapi import APIRouter, HTTPException

from app.config import get_settings
from app.models.chat import UploadImageRequest


router = APIRouter()

EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}


@router.post("/upload-image")
async def upload_image(request: UploadImageRequest):
    match = re.match(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$", request.base64_image)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid image payload")

    mime_type = match.group(1).lower()
    extension = EXTENSIONS.get(mime_type)
    if not extension:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    try:
        content = base64.b64decode(match.group(2), validate=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid base64 image data") from exc

    settings = get_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    image_key = f"chat_{int(time.time() * 1000)}_{token_hex(3)}.{extension}"
    image_path = settings.upload_dir / image_key
    image_path.write_bytes(content)
    return {"success": True, "imageKey": image_key, "imageUrl": f"/uploads/{image_key}"}

