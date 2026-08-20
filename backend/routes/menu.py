from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db
from models import MenuItem, ModifierGroup

router = APIRouter(prefix="/api/menu", tags=["menu"])


class SetAvailabilityRequest(BaseModel):
    is_available: bool
    reason: Optional[str] = None


def _serialize(i: MenuItem) -> dict:
    return {
        "id": i.id,
        "name": i.name,
        "description": i.description,
        "price_cents": i.price_cents,
        "category": i.category,
        "image_url": i.image_url,
        "is_available": i.is_available,
        "unavailable_reason": i.unavailable_reason,
        "modifier_groups": [
            {
                "id": g.id,
                "name": g.name,
                "min_select": g.min_select,
                "max_select": g.max_select,
                "modifiers": [
                    {"id": m.id, "name": m.name, "price_cents": m.price_cents} for m in g.modifiers
                ],
            }
            for g in i.modifier_groups
        ],
    }


@router.get("/")
async def list_menu(db: AsyncSession = Depends(get_db)):
    # Includes unavailable items (sold out / out of order) so the kiosk can show them
    # greyed out instead of silently disappearing -- order creation still rejects them
    # server-side regardless of what the kiosk enforces.
    result = await db.execute(
        select(MenuItem)
        .where(MenuItem.is_active == True)  # noqa: E712
        .options(selectinload(MenuItem.modifier_groups).selectinload(ModifierGroup.modifiers))
        .order_by(MenuItem.category, MenuItem.name)
    )
    items = result.scalars().all()
    return {"items": [_serialize(i) for i in items]}


@router.patch("/{item_id}/availability")
async def set_availability(item_id: int, req: SetAvailabilityRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MenuItem)
        .options(selectinload(MenuItem.modifier_groups).selectinload(ModifierGroup.modifiers))
        .where(MenuItem.id == item_id)
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Menu item not found")

    item.is_available = req.is_available
    item.unavailable_reason = req.reason if not req.is_available else None
    await db.commit()
    await db.refresh(item)
    return _serialize(item)
