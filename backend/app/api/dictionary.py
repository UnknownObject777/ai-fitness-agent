from fastapi import APIRouter

from app.services.nutrition_api_service import search_food_logics


router = APIRouter()


@router.get("/dictionary/foods")
async def foods(q: str = ""):
    return {"success": True, "data": await search_food_logics(q)}

