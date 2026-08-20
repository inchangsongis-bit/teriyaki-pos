from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from database import get_db
from models import Order, OrderItem, OrderItemModifier, MenuItem, Modifier, ModifierGroup, ORDER_STATUSES

router = APIRouter(prefix="/api/orders", tags=["orders"])


class CartItem(BaseModel):
    menu_item_id: int
    qty: int = 1
    notes: Optional[str] = None
    modifier_ids: list[int] = []


class CreateOrderRequest(BaseModel):
    items: list[CartItem]


class UpdateOrderStatusRequest(BaseModel):
    status: str


ORDER_EAGER_LOAD = selectinload(Order.items).selectinload(OrderItem.modifiers)


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
                "modifiers": [
                    {"name": m.name_at_order, "price_cents": m.price_cents_at_order}
                    for m in i.modifiers
                ],
            }
            for i in order.items
        ],
    }


@router.post("/")
async def create_order(req: CreateOrderRequest, db: AsyncSession = Depends(get_db)):
    if not req.items:
        raise HTTPException(status_code=400, detail="Order must have at least one item")

    menu_item_ids = [item.menu_item_id for item in req.items]
    result = await db.execute(
        select(MenuItem)
        .where(MenuItem.id.in_(menu_item_ids))
        .options(selectinload(MenuItem.modifier_groups).selectinload(ModifierGroup.modifiers))
    )
    menu_items_by_id = {m.id: m for m in result.scalars().all()}

    missing = set(menu_item_ids) - set(menu_items_by_id)
    if missing:
        raise HTTPException(status_code=404, detail=f"Unknown menu item(s): {sorted(missing)}")

    all_modifier_ids = {mid for item in req.items for mid in item.modifier_ids}
    modifiers_by_id: dict[int, Modifier] = {}
    if all_modifier_ids:
        mod_result = await db.execute(select(Modifier).where(Modifier.id.in_(all_modifier_ids)))
        modifiers_by_id = {m.id: m for m in mod_result.scalars().all()}
        missing_mods = all_modifier_ids - set(modifiers_by_id)
        if missing_mods:
            raise HTTPException(status_code=404, detail=f"Unknown modifier(s): {sorted(missing_mods)}")

    order = Order(status="PENDING", total_cents=0)
    total_cents = 0
    for cart_item in req.items:
        menu_item = menu_items_by_id[cart_item.menu_item_id]
        selected_modifiers = [modifiers_by_id[mid] for mid in cart_item.modifier_ids]

        for group in menu_item.modifier_groups:
            group_modifier_ids = {m.id for m in group.modifiers}
            selected_in_group = sum(1 for m in selected_modifiers if m.id in group_modifier_ids)
            if selected_in_group < group.min_select:
                raise HTTPException(
                    status_code=400,
                    detail=f"'{menu_item.name}': '{group.name}' requires at least {group.min_select} selection(s)",
                )
            if group.max_select is not None and selected_in_group > group.max_select:
                raise HTTPException(
                    status_code=400,
                    detail=f"'{menu_item.name}': '{group.name}' allows at most {group.max_select} selection(s)",
                )

        allowed_modifier_ids = {m.id for g in menu_item.modifier_groups for m in g.modifiers}
        invalid = [m.id for m in selected_modifiers if m.id not in allowed_modifier_ids]
        if invalid:
            raise HTTPException(
                status_code=400, detail=f"'{menu_item.name}' does not support modifier(s) {invalid}"
            )

        unit_price = menu_item.price_cents + sum(m.price_cents for m in selected_modifiers)
        total_cents += unit_price * cart_item.qty

        order_item = OrderItem(
            menu_item_id=menu_item.id,
            name_at_order=menu_item.name,
            price_cents_at_order=unit_price,
            qty=cart_item.qty,
            notes=cart_item.notes,
        )
        order_item.modifiers = [
            OrderItemModifier(name_at_order=m.name, price_cents_at_order=m.price_cents)
            for m in selected_modifiers
        ]
        order.items.append(order_item)

    order.total_cents = total_cents

    db.add(order)
    await db.commit()

    result = await db.execute(select(Order).options(ORDER_EAGER_LOAD).where(Order.id == order.id))
    return _serialize(result.scalar_one())


@router.get("/")
async def list_orders(status: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    query = select(Order).options(ORDER_EAGER_LOAD).order_by(Order.created_at)
    if status:
        statuses = [s.strip().upper() for s in status.split(",")]
        query = query.where(Order.status.in_(statuses))
    result = await db.execute(query)
    orders = result.scalars().all()
    return {"orders": [_serialize(o) for o in orders]}


@router.get("/{order_id}")
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).options(ORDER_EAGER_LOAD).where(Order.id == order_id)
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
        select(Order).options(ORDER_EAGER_LOAD).where(Order.id == order_id)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = status
    await db.commit()
    await db.refresh(order, attribute_names=["items"])
    return _serialize(order)
