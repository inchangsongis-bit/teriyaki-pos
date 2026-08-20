from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db
from models import MenuItem, ModifierGroup

router = APIRouter(prefix="/api/menu", tags=["menu"])


@router.get("/")
async def list_menu(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MenuItem)
        .where(MenuItem.is_active == True)  # noqa: E712
        .options(selectinload(MenuItem.modifier_groups).selectinload(ModifierGroup.modifiers))
        .order_by(MenuItem.category, MenuItem.name)
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
                "modifier_groups": [
                    {
                        "id": g.id,
                        "name": g.name,
                        "min_select": g.min_select,
                        "max_select": g.max_select,
                        "modifiers": [
                            {"id": m.id, "name": m.name, "price_cents": m.price_cents}
                            for m in g.modifiers
                        ],
                    }
                    for g in i.modifier_groups
                ],
            }
            for i in items
        ]
    }
