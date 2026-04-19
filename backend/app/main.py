from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.chat import router as chat_router
from app.api.memory import router as memory_router
from app.api.records import router as records_router
from app.api.sessions import router as sessions_router
from app.api.uploads import router as uploads_router
from app.config import get_settings
from app.services.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    await init_db()
    yield


app = FastAPI(
    title="Sparky AI Fitness Agent",
    version="2.0.0",
    lifespan=lifespan,
)

settings = get_settings()
settings.upload_dir.mkdir(parents=True, exist_ok=True)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/uploads", StaticFiles(directory=str(settings.upload_dir)), name="uploads")
app.include_router(chat_router, prefix="/api")
app.include_router(sessions_router, prefix="/api")
app.include_router(records_router, prefix="/api")
app.include_router(memory_router, prefix="/api")
app.include_router(uploads_router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"success": True, "status": "ok"}
