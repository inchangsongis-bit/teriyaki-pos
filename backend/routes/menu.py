from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import MenuItem

router = APIRouter(prefix="/api/menu", tags=["menu"])


@router.get("/")
async def list_menu(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MenuItem).where(MenuItem.is_active == True).order_by(MenuItem.category, MenuItem.name)  # noqa: E712
    )
    items = result.scalars().all()
    return {
        "items": [
            {
                "id": i.id,
                "name": i.name,
                "description": i.description,
                "price_cents": i.price_cents,
                "category": i.category,
                "image_url": i.image_url,
            }
            for i in items
        ]
    }
