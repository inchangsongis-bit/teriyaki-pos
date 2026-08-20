"""Seed the DB with the teriyaki restaurant's menu. Run with: python seed.py"""

import asyncio

from database import async_session, init_db
from models import MenuItem, ModifierGroup, Modifier

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

# Matches the real restaurant's Clover "UPGRADE" modifier group: multi-select,
# no minimum, additive pricing. Applied to entrees (Bowls) only, same as the
# real site leaves sides/drinks with no modifier group at all.
UPGRADE_MODIFIERS = [
    ("Brown Rice", 200),
    ("Fried Rice", 250),
    ("Stir Fried Veggies", 300),
    ("Noodles", 200),
    ("All Rice", 0),
    ("All Salad", 0),
    ("Spicy", 200),
]


async def seed():
    await init_db()
    async with async_session() as db:
        upgrade_group = ModifierGroup(name="Upgrade", min_select=0, max_select=None)
        upgrade_group.modifiers = [
            Modifier(name=name, price_cents=price_cents) for name, price_cents in UPGRADE_MODIFIERS
        ]
        db.add(upgrade_group)

        for name, description, price_cents, category in MENU:
            item = MenuItem(name=name, description=description, price_cents=price_cents, category=category)
            if category == "Bowls":
                item.modifier_groups = [upgrade_group]
            db.add(item)

        await db.commit()
    print(f"Seeded {len(MENU)} menu items and 1 modifier group.")


if __name__ == "__main__":
    asyncio.run(seed())
