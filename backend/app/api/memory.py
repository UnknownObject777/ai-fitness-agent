from fastapi import APIRouter

from app.services.memory import get_or_init_semantic_memory


router = APIRouter()


@router.get("/semantic-memory")
async def semantic_memory():
    return {"success": True, "memory": await get_or_init_semantic_memory("user_1")}

