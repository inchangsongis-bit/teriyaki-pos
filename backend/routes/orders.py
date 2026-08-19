from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db
from models import Order, OrderItem, MenuItem, ORDER_STATUSES

router = APIRouter(prefix="/api/orders", tags=["orders"])


class CartItem(BaseModel):
    menu_item_id: int
    qty: int = 1
    notes: Optional[str] = None


class CreateOrderRequest(BaseModel):
    items: list[CartItem]


class UpdateOrderStatusRequest(BaseModel):
    status: str


def _serialize(order: Order) -> dict:
    return {
        "id": order.id,
        "status": order.status,
        "total_cents": order.total_cents,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items": [
            {
                "name": i.name_at_order,
                "qty": i.qty,
                "price_cents": i.price_cents_at_order,
                "notes": i.notes,
            }
            for i in order.items
        ],
    }


@router.post("/")
async def create_order(req: CreateOrderRequest, db: AsyncSession = Depends(get_db)):
    if not req.items:
        raise HTTPException(status_code=400, detail="Order must have at least one item")

    menu_item_ids = [item.menu_item_id for item in req.items]
    result = await db.execute(select(MenuItem).where(MenuItem.id.in_(menu_item_ids)))
    menu_items_by_id = {m.id: m for m in result.scalars().all()}

    missing = set(menu_item_ids) - set(menu_items_by_id)
    if missing:
        raise HTTPException(status_code=404, detail=f"Unknown menu item(s): {sorted(missing)}")

    order = Order(status="PENDING", total_cents=0)
    total_cents = 0
    for cart_item in req.items:
        menu_item = menu_items_by_id[cart_item.menu_item_id]
        line_total = menu_item.price_cents * cart_item.qty
        total_cents += line_total
        order.items.append(
            OrderItem(
                menu_item_id=menu_item.id,
                name_at_order=menu_item.name,
                price_cents_at_order=menu_item.price_cents,
                qty=cart_item.qty,
                notes=cart_item.notes,
            )
        )
    order.total_cents = total_cents

    db.add(order)
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    return _serialize(order)


@router.get("/")
async def list_orders(status: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    query = select(Order).options(selectinload(Order.items)).order_by(Order.created_at)
    if status:
        statuses = [s.strip().upper() for s in status.split(",")]
        query = query.where(Order.status.in_(statuses))
    result = await db.execute(query)
    orders = result.scalars().all()
    return {"orders": [_serialize(o) for o in orders]}


@router.get("/{order_id}")
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return _serialize(order)


@router.patch("/{order_id}")
async def update_order_status(order_id: int, req: UpdateOrderStatusRequest, db: AsyncSession = Depends(get_db)):
    status = req.status.strip().upper()
    if status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {ORDER_STATUSES}")

    result = await db.execute(
        select(Order).options(selectinload(Order.items)).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = status
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    return _serialize(order)
