"""Seed the DB with the teriyaki restaurant's menu. Run with: python seed.py"""

import asyncio

from database import async_session, init_db
from models import MenuItem

MENU = [
    ("Chicken Teriyaki Bowl", "Grilled chicken thigh, house teriyaki sauce, steamed rice", 1195, "Bowls"),
    ("Beef Teriyaki Bowl", "Sliced beef, house teriyaki sauce, steamed rice", 1395, "Bowls"),
    ("Salmon Teriyaki Bowl", "Grilled salmon, house teriyaki sauce, steamed rice", 1495, "Bowls"),
    ("Tofu Teriyaki Bowl", "Crispy tofu, house teriyaki sauce, steamed rice", 1095, "Bowls"),
    ("Spring Rolls (4pc)", "Crispy vegetable spring rolls, sweet chili sauce", 595, "Appetizers"),
    ("Gyoza (6pc)", "Pan-seared pork dumplings, ponzu dipping sauce", 695, "Appetizers"),
    ("Edamame", "Steamed, salted", 495, "Appetizers"),
    ("Miso Soup", "Traditional miso soup with tofu and scallion", 350, "Sides"),
    ("Green Salad", "House ginger dressing", 450, "Sides"),
    ("Fountain Drink", "Refillable", 275, "Drinks"),
    ("Green Tea", "Hot or iced", 250, "Drinks"),
]


async def seed():
    await init_db()
    async with async_session() as db:
        for name, description, price_cents, category in MENU:
            db.add(MenuItem(name=name, description=description, price_cents=price_cents, category=category))
        await db.commit()
    print(f"Seeded {len(MENU)} menu items.")


if __name__ == "__main__":
    asyncio.run(seed())
