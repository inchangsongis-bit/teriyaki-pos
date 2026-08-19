from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base

# Order lifecycle: PENDING -> PAID -> PRINTED -> COMPLETED (or CANCELLED at any point before PAID)
ORDER_STATUSES = ("PENDING", "PAID", "PRINTED", "COMPLETED", "CANCELLED")


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    price_cents = Column(Integer, nullable=False)
    category = Column(String(50), nullable=False, index=True)
    image_url = Column(String(500))
    is_active = Column(Boolean, nullable=False, default=True)


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    status = Column(String(20), nullable=False, default="PENDING", index=True)
    total_cents = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    stripe_payment_intent_id = Column(String(100), index=True)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    menu_item_id = Column(Integer, ForeignKey("menu_items.id"), nullable=False)
    name_at_order = Column(String(100), nullable=False)
    price_cents_at_order = Column(Integer, nullable=False)
    qty = Column(Integer, nullable=False, default=1)
    notes = Column(String(280))

    order = relationship("Order", back_populates="items")
