# Teriyaki POS

A custom point-of-sale system — kiosk ordering, kitchen display, staff register — built to
replace a teriyaki restaurant's current Clover setup. The menu/modifier structure is modeled
after the restaurant's existing Clover Online site (Ichi 2 Teriyaki, Kent WA).

## Stack

- **Backend**: FastAPI (Python), SQLite
- **Frontend**: Next.js (TypeScript, Tailwind)
- **Payments**: Stripe Terminal, semi-integrated (card-present via a connected reader, not
  embedded card handling — see [Clover's semi-integration model](https://docs.clover.com/dev/docs/clover-development-basics-semi),
  which this follows)
- **Kitchen printing**: ESC/POS network thermal printer via `python-escpos`

## Project structure

```
backend/
  server.py        FastAPI app entrypoint
  routes/          menu, orders, payments endpoints
  service/         stripe_terminal.py, printer.py
  models.py        SQLAlchemy models
  database.py      async SQLite session setup
  config.py        env-based settings
  seed.py          seeds the menu table
frontend/
  app/kiosk/        customer-facing ordering UI
  app/kitchen/       kitchen order queue display
  lib/api.ts         typed backend API client
```

## Running locally

Backend (port 8001):

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env   # fill in real Stripe keys when ready
python seed.py
uvicorn server:app --reload --port 8001
```

Frontend (port 3001):

```bash
cd frontend
npm install
npm run dev -- --port 3001
```

Ports 3000/8000 are intentionally avoided — reserved by another local project on this machine.

## Status

Core loop is built and verified end-to-end: kiosk ordering → Stripe Terminal payment →
kitchen ticket print → kitchen queue → mark complete. Stripe is wired against the connection
token / payment intent flow but `.env` still holds a placeholder key — needs a real Stripe
test account to verify actual payment collection.

## Planned / in design

Requirements gathered so far, not yet implemented:

- Item modifiers (rice/side swaps, spicy, additive pricing — matches the Clover site's
  "UPGRADE" modifier group pattern)
- Sold out / out of order toggle per menu item, with reason
- "Call staff" button on the kiosk, alerting both the kitchen display and a front-counter screen
- Dine-in vs. to-go order type (bag fee only on to-go, table number for dine-in)
- Cash payment support + a staff register screen, with till tracking
- Tip step at checkout (preset % + custom)
- WA sales tax
- Menu item photos
- Loyalty/rewards: phone-number-linked account, configurable spend threshold ($100 → $7
  credit by default), manual redemption, expiring balance, staff-side account merge
