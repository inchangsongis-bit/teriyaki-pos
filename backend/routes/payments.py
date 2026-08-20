import logging

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from config import get_settings
from database import get_db
from models import Order, OrderItem
from service import stripe_terminal, printer

logger = logging.getLogger(__name__)
router = APIRouter(tags=["payments"])


@router.post("/api/payments/connection-token")
async def connection_token():
    try:
        return {"secret": stripe_terminal.create_connection_token()}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e.user_message or str(e)}")


@router.post("/api/orders/{order_id}/payment-intent")
async def create_payment_intent(order_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "PENDING":
        raise HTTPException(status_code=409, detail=f"Order is {order.status}, expected PENDING")

    try:
        intent = stripe_terminal.create_payment_intent(order.id, order.total_cents)
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e.user_message or str(e)}")

    order.stripe_payment_intent_id = intent.id
    await db.commit()
    return {"client_secret": intent.client_secret}


@router.post("/api/payments/webhook")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    settings = get_settings()

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.stripe_webhook_secret)
    except (ValueError, stripe.error.SignatureVerificationError):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    if event["type"] == "payment_intent.succeeded":
        intent = event["data"]["object"]
        result = await db.execute(
            select(Order)
            .options(selectinload(Order.items).selectinload(OrderItem.modifiers))
            .where(Order.stripe_payment_intent_id == intent["id"])
        )
        order = result.scalar_one_or_none()
        if order and order.status == "PENDING":
            order.status = "PAID"
            await db.commit()

            printer.print_ticket(order)

            order.status = "PRINTED"
            await db.commit()

    return {"received": True}
