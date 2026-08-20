from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from database import Base

# Order lifecycle: PENDING -> PAID -> PRINTED -> COMPLETED (or CANCELLED at any point before PAID)
ORDER_STATUSES = ("PENDING", "PAID", "PRINTED", "COMPLETED", "CANCELLED")

menu_item_modifier_groups = Table(
    "menu_item_modifier_groups",
    Base.metadata,
    Column("menu_item_id", ForeignKey("menu_items.id"), primary_key=True),
    Column("modifier_group_id", ForeignKey("modifier_groups.id"), primary_key=True),
)


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    price_cents = Column(Integer, nullable=False)
    category = Column(String(50), nullable=False, index=True)
    image_url = Column(String(500))
    is_active = Column(Boolean, nullable=False, default=True)
    is_available = Column(Boolean, nullable=False, default=True)
    unavailable_reason = Column(String(100))

    modifier_groups = relationship(
        "ModifierGroup", secondary=menu_item_modifier_groups, back_populates="menu_items"
    )


class ModifierGroup(Base):
    __tablename__ = "modifier_groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    min_select = Column(Integer, nullable=False, default=0)
    max_select = Column(Integer)  # null = unlimited

    modifiers = relationship("Modifier", back_populates="group", cascade="all, delete-orphan")
    menu_items = relationship(
        "MenuItem", secondary=menu_item_modifier_groups, back_populates="modifier_groups"
    )


class Modifier(Base):
    __tablename__ = "modifiers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("modifier_groups.id"), nullable=False)
    name = Column(String(100), nullable=False)
    price_cents = Column(Integer, nullable=False, default=0)

    group = relationship("ModifierGroup", back_populates="modifiers")


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
    modifiers = relationship(
        "OrderItemModifier", back_populates="order_item", cascade="all, delete-orphan"
    )


class OrderItemModifier(Base):
    __tablename__ = "order_item_modifiers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_item_id = Column(Integer, ForeignKey("order_items.id"), nullable=False)
    name_at_order = Column(String(100), nullable=False)
    price_cents_at_order = Column(Integer, nullable=False)

    order_item = relationship("OrderItem", back_populates="modifiers")
