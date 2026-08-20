from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import StaffAlert, ALERT_STATUSES

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


class CreateAlertRequest(BaseModel):
    location: str = "Kiosk"
    message: Optional[str] = None


class UpdateAlertStatusRequest(BaseModel):
    status: str


def _serialize(a: StaffAlert) -> dict:
    return {
        "id": a.id,
        "location": a.location,
        "message": a.message,
        "status": a.status,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "resolved_at": a.resolved_at.isoformat() if a.resolved_at else None,
    }


@router.post("/")
async def create_alert(req: CreateAlertRequest, db: AsyncSession = Depends(get_db)):
    alert = StaffAlert(location=req.location, message=req.message, status="OPEN")
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return _serialize(alert)


@router.get("/")
async def list_alerts(status: Optional[str] = Query(None), db: AsyncSession = Depends(get_db)):
    query = select(StaffAlert).order_by(StaffAlert.created_at.desc())
    if status:
        statuses = [s.strip().upper() for s in status.split(",")]
        query = query.where(StaffAlert.status.in_(statuses))
    result = await db.execute(query)
    alerts = result.scalars().all()
    return {"alerts": [_serialize(a) for a in alerts]}


@router.patch("/{alert_id}")
async def update_alert_status(alert_id: int, req: UpdateAlertStatusRequest, db: AsyncSession = Depends(get_db)):
    status = req.status.strip().upper()
    if status not in ALERT_STATUSES:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {ALERT_STATUSES}")

    result = await db.execute(select(StaffAlert).where(StaffAlert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = status
    if status == "RESOLVED":
        alert.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(alert)
    return _serialize(alert)
