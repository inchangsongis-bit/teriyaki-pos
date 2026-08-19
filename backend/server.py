"""
Teriyaki POS API — FastAPI backend
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import init_db
from routes import menu, orders, payments


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Teriyaki POS API",
    description="Kiosk ordering, payment, and kitchen ticket backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(menu.router)
app.include_router(orders.router)
app.include_router(payments.router)


@app.get("/")
async def root():
    return {
        "app": "Teriyaki POS",
        "version": "0.1.0",
        "docs": "/docs",
        "endpoints": [
            "GET   /api/menu/",
            "POST  /api/orders/",
            "GET   /api/orders/",
            "GET   /api/orders/{id}",
            "PATCH /api/orders/{id}",
            "POST  /api/payments/connection-token",
            "POST  /api/orders/{id}/payment-intent",
            "POST  /api/payments/webhook",
        ],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
