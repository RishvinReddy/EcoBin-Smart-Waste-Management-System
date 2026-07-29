"""
Smart Waste Management Platform — FastAPI Backend
Municipal Corporation of Hyderabad — AI Routing Engine

Features:
    - IoT REST API (POST /api/bin/update) — ESP32 compatible
    - WebSocket live updates (/ws/live)
    - ML prediction (XGBoost, 24h ahead)
    - Google OR-Tools CVRP route optimization
    - Hardware-identical simulation engine
    - Notification engine (>80% threshold alerts)
    - Full CORS + Swagger documentation

Hardware Integration:
    ESP32 devices communicate via POST /api/bin/update.
    Simulator uses the identical endpoint — swap without code changes.
"""
import os
import sys
import json
import asyncio
import pickle
import datetime
import threading
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Set
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from database.db import get_db, init_db, engine
from database.models import Bin, FillHistory, Prediction, Truck, Driver, OptimizedRoute, Notification, CollectionRequest, MaintenanceWorker, MaintenanceLog, QRCode
from backend.services.email_service import send_email_alert
from ml.data_generator.generator import run_generation
from ml.preprocessing.features import build_features
from ml.forecasting.models import train_and_evaluate_models, calculate_overflow_probability
from optimization.vrp_solver.solver import solve_cvrp, simulate_fixed_schedule

# ─────────────────────────────────────────────────────────────
#  GLOBAL SIMULATION STATE
# ─────────────────────────────────────────────────────────────

class SimulationState:
    """Thread-safe simulation state manager."""
    def __init__(self):
        self.running = False
        self.speed_multiplier = 1.0   # 1x, 5x, 10x, 24x
        self.interval_seconds = 60.0  # Simulate 1 hour every 60 real seconds (at 1x)
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
    
    def start(self, speed: float = 1.0):
        if self.running:
            return False
        self.running = True
        self.speed_multiplier = speed
        self.interval_seconds = max(1.0, 60.0 / speed)
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        return True
    
    def stop(self):
        self.running = False
        self._stop_event.set()
    
    def set_speed(self, speed: float):
        self.speed_multiplier = speed
        self.interval_seconds = max(1.0, 60.0 / speed)
    
    def _run_loop(self):
        """Background simulation loop — calls the same IoT endpoint the ESP32 would use."""
        import requests
        import random
        
        print(f"[Simulator] Started at {self.speed_multiplier}x speed (interval: {self.interval_seconds:.1f}s)")
        
        while not self._stop_event.is_set():
            try:
                db: Session = next(get_db())
                bins = db.query(Bin).filter(Bin.status == "Active").all()
                db.close()
                
                for b in bins:
                    if self._stop_event.is_set():
                        break
                    
                    # Generate realistic fill increment
                    hour = datetime.datetime.now().hour
                    area_rates = {
                        "Residential": 1.8, "Commercial": 2.5, "Market": 3.8,
                        "Hospital": 2.2, "School": 2.0, "Restaurant": 3.2,
                        "Mall": 3.5, "Bus Stand": 2.8, "Railway Station": 3.0,
                        "Park": 0.9, "Industrial": 2.0
                    }
                    base_rate = area_rates.get(b.area_type, 2.0)
                    noise = np.random.normal(1.0, 0.2)
                    increment = (base_rate * noise * self.speed_multiplier) / 10.0
                    
                    current = b.current_fill_percentage or 0.0
                    new_fill = min(100.0, current + increment)
                    
                    # Build the exact same payload ESP32 would send
                    payload = {
                        "bin_id": b.bin_id,
                        "fill_percentage": round(new_fill, 1),
                        "battery": round(b.battery_level - random.uniform(0, 0.05), 1) if b.battery_level else 95.0,
                        "temperature": round(28 + np.random.normal(0, 2), 1),
                        "latitude": b.latitude,
                        "longitude": b.longitude,
                        "timestamp": datetime.datetime.now().isoformat()
                    }
                    
                    # Call our own IoT endpoint (identical to what ESP32 would call)
                    try:
                        requests.post("http://127.0.0.1:8000/api/bin/update", json=payload, timeout=2)
                    except Exception:
                        pass
                
                self._stop_event.wait(timeout=self.interval_seconds)
                
            except Exception as e:
                print(f"[Simulator] Error: {e}")
                self._stop_event.wait(timeout=5)
        
        print("[Simulator] Stopped.")


sim_state = SimulationState()


# ─────────────────────────────────────────────────────────────
#  WEBSOCKET MANAGER
# ─────────────────────────────────────────────────────────────

class WebSocketManager:
    """Manages active WebSocket connections for real-time broadcast."""
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        print(f"[WS] Client connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        print(f"[WS] Client disconnected. Total: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        if not self.active_connections:
            return
        data = json.dumps(message)
        dead = set()
        for ws in self.active_connections:
            try:
                await ws.send_text(data)
            except Exception:
                dead.add(ws)
        self.active_connections -= dead


ws_manager = WebSocketManager()


# ─────────────────────────────────────────────────────────────
#  FASTAPI APP
# ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    print("[Server] Database initialized.")
    
    # Seed default maintenance workers on first run
    from database.db import SessionLocal
    _db = SessionLocal()
    try:
        MAINTENANCE_TEAM = [
            {"worker_id": "MNT001", "name": "Arun Sharma", "phone": "+91 99001 11001", "zone": "Banjara Hills / Jubilee Hills"},
            {"worker_id": "MNT002", "name": "Sujatha Devi", "phone": "+91 99001 11002", "zone": "Begumpet / Secunderabad"},
            {"worker_id": "MNT003", "name": "Ravi Kiran", "phone": "+91 99001 11003", "zone": "Kukatpally / KPHB"},
            {"worker_id": "MNT004", "name": "Priya Nair", "phone": "+91 99001 11004", "zone": "LB Nagar / Dilsukhnagar"},
        ]
        for wdata in MAINTENANCE_TEAM:
            if not _db.query(MaintenanceWorker).filter(MaintenanceWorker.worker_id == wdata["worker_id"]).first():
                _db.add(MaintenanceWorker(**wdata))
        _db.commit()
        print("[Server] Maintenance workers seeded.")
    except Exception as e:
        print(f"[Server] Worker seed error: {e}")
        _db.rollback()
    finally:
        _db.close()
    
    yield
    sim_state.stop()
    print("[Server] Shutdown complete.")

app = FastAPI(
    title="Smart Waste Management Platform — Hyderabad",
    description="""
## Municipal Corporation of Hyderabad — AI Waste Routing Engine

This API is designed for **production IoT integration**. The `POST /api/bin/update` endpoint
is the primary ingestion point for **ESP32-based smart bins**.

### Hardware Integration
ESP32 devices send periodic payloads to `/api/bin/update`. The simulator uses the identical
endpoint — swap hardware for simulator without changing the backend.

### Key Modules
- **IoT Ingestion**: Real-time bin readings from hardware
- **ML Prediction**: XGBoost 24-hour fill-level forecast  
- **Route Optimization**: Google OR-Tools CVRP solver
- **Notification Engine**: Auto-alerts when bins exceed 80%
- **WebSocket**: Live dashboard updates
    """,
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────
#  PYDANTIC SCHEMAS
# ─────────────────────────────────────────────────────────────

class BinUpdatePayload(BaseModel):
    """
    IoT sensor payload — identical to what an ESP32 device sends.
    POST /api/bin/update
    """
    bin_id: str = Field(..., example="BIN034")
    fill_percentage: float = Field(..., ge=0, le=100, example=82.5)
    battery: Optional[float] = Field(None, ge=0, le=100, example=91.0)
    temperature: Optional[float] = Field(None, example=31.2)
    latitude: Optional[float] = Field(None, example=17.3616)
    longitude: Optional[float] = Field(None, example=78.4747)
    timestamp: Optional[str] = Field(None, example="2024-07-17T18:30:00")


class SimulateControlPayload(BaseModel):
    speed: Optional[float] = Field(1.0, ge=0.1, le=60.0, description="Speed multiplier (1x to 60x)")


class BinStatusUpdate(BaseModel):
    status: str


class BinCreatePayload(BaseModel):
    bin_id: str = Field(..., example="BIN101")
    latitude: float = Field(..., example=17.41)
    longitude: float = Field(..., example=78.45)
    street_name: str = Field(..., example="Road No. 10")
    area_name: str = Field(..., example="Banjara Hills")
    ward: str = Field(..., example="Ward-10")
    ward_number: int = Field(..., example=10)
    area_type: str = Field(..., example="Residential")
    capacity: float = Field(..., example=240.0)


class TruckCreatePayload(BaseModel):
    truck_id: str = Field(..., example="TRK-HYD-06")
    plate_number: str = Field(..., example="TS09EA0006")
    capacity: float = Field(..., example=5000.0)
    driver_id: str = Field(..., example="DRV006")
    driver_name: str = Field(..., example="Anil Kumar")
    driver_phone: Optional[str] = Field(None, example="9876543215")
    driver_license: Optional[str] = Field(None, example="TS123461")


class BinUpdateDetails(BaseModel):
    latitude: float = Field(..., example=17.41)
    longitude: float = Field(..., example=78.45)
    street_name: str = Field(..., example="Road No. 10")
    area_name: str = Field(..., example="Banjara Hills")
    ward: str = Field(..., example="Ward-10")
    ward_number: int = Field(..., example=10)
    area_type: str = Field(..., example="Residential")
    capacity: float = Field(..., example=240.0)
    status: str = Field(..., example="Active")


class TruckUpdateDetails(BaseModel):
    plate_number: str = Field(..., example="TS09EA0006")
    capacity: float = Field(..., example=5000.0)
    driver_id: str = Field(..., example="DRV006")
    driver_name: str = Field(..., example="Anil Kumar")
    driver_phone: Optional[str] = Field(None, example="9876543215")
    driver_license: Optional[str] = Field(None, example="TS123461")
    status: str = Field(..., example="Idle")


# ─────────────────────────────────────────────────────────────
#  HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────

def calculate_priority(predicted_fill: float, overflow_prob: float, area_type: str) -> float:
    """
    Computes bin priority score (0-100) for route inclusion.
    Weights: fill (60%) + overflow probability (20%) + area hazard (20%)
    """
    area_weights = {
        "Hospital": 1.0, "School": 0.9, "Restaurant": 0.9, "Market": 0.8,
        "Railway Station": 0.8, "Bus Stand": 0.8, "Mall": 0.7,
        "Residential": 0.6, "Commercial": 0.5, "Park": 0.4, "Industrial": 0.3
    }
    w = area_weights.get(area_type, 0.4)
    score = (predicted_fill * 0.6) + (overflow_prob * 100 * 0.2) + (w * 100 * 0.2)
    return round(score, 1)


async def create_notification_if_needed(db: Session, bin_obj: Bin, fill_pct: float):
    """Creates an overflow notification if bin exceeds 80%."""
    if fill_pct >= 80.0:
        # Check for existing recent notification (within 2 hours) to avoid spam
        cutoff = datetime.datetime.now() - datetime.timedelta(hours=2)
        recent = db.query(Notification).filter(
            Notification.bin_id == bin_obj.bin_id,
            Notification.created_at >= cutoff,
            Notification.is_read == False
        ).first()
        
        if not recent:
            severity = "Critical" if fill_pct >= 95 else "Warning"
            notif = Notification(
                bin_id=bin_obj.bin_id,
                severity=severity,
                title=f"Bin {bin_obj.bin_id} Overflow Alert",
                message=(
                    f"Bin {bin_obj.bin_id} at {bin_obj.street_name} ({bin_obj.area_name}) "
                    f"has reached {fill_pct:.1f}% capacity. Immediate collection required. "
                    f"Ward: {bin_obj.ward}."
                ),
                is_read=False,
                created_at=datetime.datetime.now()
            )
            db.add(notif)
            
            # Add to collection queue
            col_req = CollectionRequest(
                bin_id=bin_obj.bin_id,
                created_at=datetime.datetime.now(),
                fill_at_request=fill_pct,
                status="Pending"
            )
            db.add(col_req)
            
            # Send EmailJS Alert
            asyncio.create_task(asyncio.to_thread(
                send_email_alert,
                heading=f"🚨 {severity.upper()} OVERFLOW ALERT",
                greeting="Attention System Admin,",
                message=f"Bin {bin_obj.bin_id} has reached {fill_pct:.1f}% capacity and requires immediate collection.",
                details=f"Bin ID: {bin_obj.bin_id}\nLocation: {bin_obj.street_name} ({bin_obj.area_name})\nWard: {bin_obj.ward}\nCapacity: {fill_pct:.1f}%"
            ))


# ─────────────────────────────────────────────────────────────
#  SYSTEM ENDPOINTS
# ─────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["System"])
def health_check():
    """System health check — returns status and timestamp."""
    return {
        "status": "healthy",
        "timestamp": datetime.datetime.now().isoformat(),
        "simulation_running": sim_state.running,
        "simulation_speed": sim_state.speed_multiplier,
        "active_ws_clients": len(ws_manager.active_connections)
    }


# ─────────────────────────────────────────────────────────────
#  IOT INGESTION ENDPOINT
# ─────────────────────────────────────────────────────────────

@app.post("/api/bin/update", tags=["IoT Hardware"])
async def iot_bin_update(payload: BinUpdatePayload, db: Session = Depends(get_db)):
    """
    ## Primary IoT Ingestion Endpoint
    
    Compatible with **ESP32 + Ultrasonic Sensor** hardware.
    
    **Hardware sends this every 5-60 minutes:**
    ```json
    {
        "bin_id": "BIN034",
        "fill_percentage": 82.5,
        "battery": 91.0,
        "temperature": 31.2,
        "latitude": 17.3616,
        "longitude": 78.4747,
        "timestamp": "2024-07-17T18:30:00"
    }
    ```
    
    **Server actions:**
    1. Updates bin's live state in database
    2. Appends to fill_history for ML training
    3. Triggers notification if fill >= 80%
    4. Broadcasts update via WebSocket to all dashboard clients
    """
    bin_obj = db.query(Bin).filter(Bin.bin_id == payload.bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail=f"Bin {payload.bin_id} not found in database.")
    
    now = datetime.datetime.now()
    ts = datetime.datetime.fromisoformat(payload.timestamp) if payload.timestamp else now
    
    # Update live state
    bin_obj.current_fill_percentage = round(payload.fill_percentage, 2)
    if payload.battery is not None:
        bin_obj.battery_level = payload.battery
    if payload.temperature is not None:
        bin_obj.temperature = payload.temperature
    bin_obj.last_updated = ts
    
    # Optionally update GPS if device sends it (e.g., GPS module attached)
    if payload.latitude and payload.longitude:
        bin_obj.latitude = payload.latitude
        bin_obj.longitude = payload.longitude
    
    # Append to fill history
    history_entry = FillHistory(
        bin_id=payload.bin_id,
        timestamp=ts,
        fill_percentage=payload.fill_percentage,
        battery=payload.battery,
        temperature=payload.temperature,
        rainfall=0.0,
        holiday=0,
        population_density=None,
        waste_generated=None,
    )
    db.add(history_entry)
    
    # Notification engine
    await create_notification_if_needed(db, bin_obj, payload.fill_percentage)
    
    db.commit()
    
    # Broadcast to WebSocket clients
    ws_message = {
        "type": "bin_update",
        "bin_id": payload.bin_id,
        "fill_percentage": payload.fill_percentage,
        "battery": payload.battery,
        "temperature": payload.temperature,
        "latitude": bin_obj.latitude,
        "longitude": bin_obj.longitude,
        "area_type": bin_obj.area_type,
        "area_name": bin_obj.area_name,
        "ward": bin_obj.ward,
        "street_name": bin_obj.street_name,
        "status": bin_obj.status,
        "timestamp": ts.isoformat(),
        "is_critical": payload.fill_percentage >= 80.0
    }
    await ws_manager.broadcast(ws_message)
    
    return {
        "status": "accepted",
        "bin_id": payload.bin_id,
        "fill_percentage": payload.fill_percentage,
        "is_critical": payload.fill_percentage >= 80.0,
        "timestamp": ts.isoformat()
    }


# ─────────────────────────────────────────────────────────────
#  WEBSOCKET ENDPOINT
# ─────────────────────────────────────────────────────────────

@app.websocket("/ws/live")
async def websocket_live(websocket: WebSocket):
    """
    WebSocket endpoint for real-time dashboard updates.
    Broadcasts bin updates, notifications, and simulation events.
    """
    await ws_manager.connect(websocket)
    try:
        # Send initial connection confirmation
        await websocket.send_text(json.dumps({
            "type": "connected",
            "message": "Connected to Smart Waste Management live feed",
            "timestamp": datetime.datetime.now().isoformat()
        }))
        # Keep connection alive — wait for client to disconnect
        while True:
            data = await websocket.receive_text()
            # Optional: handle ping/pong
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# ─────────────────────────────────────────────────────────────
#  BINS ENDPOINTS
# ─────────────────────────────────────────────────────────────

@app.get("/api/bins", tags=["Bins"])
def list_bins(db: Session = Depends(get_db)):
    """Returns all bins with live state (current fill, battery, status, etc.)."""
    bins = db.query(Bin).all()
    result = []
    for b in bins:
        result.append({
            "bin_id": b.bin_id,
            "latitude": b.latitude,
            "longitude": b.longitude,
            "street_name": b.street_name,
            "area_name": b.area_name,
            "ward": b.ward,
            "ward_number": b.ward_number,
            "area_type": b.area_type,
            "capacity": b.capacity,
            "current_fill_percentage": round(b.current_fill_percentage or 0.0, 1),
            "battery_level": round(b.battery_level or 100.0, 1),
            "signal_strength": b.signal_strength or 90,
            "temperature": round(b.temperature, 1) if b.temperature else None,
            "status": b.status,
            "last_updated": b.last_updated.isoformat() if b.last_updated else None,
            "last_collection_time": b.last_collection_time.isoformat() if b.last_collection_time else None,
            "installation_date": b.installation_date.isoformat(),
        })
    return result


@app.get("/api/bins/live", tags=["Bins"])
def get_live_fills(db: Session = Depends(get_db)):
    """Lightweight endpoint returning only bin_id and current fill% for all bins."""
    bins = db.query(Bin.bin_id, Bin.current_fill_percentage, Bin.status, Bin.last_updated).all()
    return [
        {
            "bin_id": b.bin_id,
            "current_fill_percentage": round(b.current_fill_percentage or 0.0, 1),
            "status": b.status,
            "last_updated": b.last_updated.isoformat() if b.last_updated else None
        }
        for b in bins
    ]


@app.get("/api/bins/{bin_id}", tags=["Bins"])
def get_bin_details(bin_id: str, db: Session = Depends(get_db)):
    """Returns bin details, 7-day history trend, and tomorrow's ML forecast."""
    bin_obj = db.query(Bin).filter(Bin.bin_id == bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail="Bin not found")

    # Last 7 days of hourly history (168 records max)
    history_logs = db.query(FillHistory)\
        .filter(FillHistory.bin_id == bin_id)\
        .order_by(FillHistory.timestamp.desc())\
        .limit(168)\
        .all()
    history_logs.reverse()

    history_data = [{
        "timestamp": log.timestamp.isoformat(),
        "fill_percentage": round(log.fill_percentage, 1),
        "temperature": round(log.temperature, 1) if log.temperature else None,
        "rainfall": round(log.rainfall, 2) if log.rainfall else 0.0,
        "waste_generated": round(log.waste_generated, 2) if log.waste_generated else 0.0
    } for log in history_logs]

    # Latest prediction
    pred = db.query(Prediction)\
        .filter(Prediction.bin_id == bin_id)\
        .order_by(Prediction.prediction_time.desc())\
        .first()

    prediction_data = None
    if pred:
        prediction_data = {
            "prediction_time": pred.prediction_time.isoformat(),
            "predicted_fill": round(pred.predicted_fill, 1),
            "overflow_probability": round(pred.overflow_probability * 100, 1)
        }

    return {
        "bin_id": bin_obj.bin_id,
        "latitude": bin_obj.latitude,
        "longitude": bin_obj.longitude,
        "street_name": bin_obj.street_name,
        "area_name": bin_obj.area_name,
        "ward": bin_obj.ward,
        "ward_number": bin_obj.ward_number,
        "area_type": bin_obj.area_type,
        "capacity": bin_obj.capacity,
        "current_fill_percentage": round(bin_obj.current_fill_percentage or 0.0, 1),
        "battery_level": round(bin_obj.battery_level or 100.0, 1),
        "signal_strength": bin_obj.signal_strength or 90,
        "temperature": round(bin_obj.temperature, 1) if bin_obj.temperature else None,
        "status": bin_obj.status,
        "last_updated": bin_obj.last_updated.isoformat() if bin_obj.last_updated else None,
        "last_collection_time": bin_obj.last_collection_time.isoformat() if bin_obj.last_collection_time else None,
        "installation_date": bin_obj.installation_date.isoformat(),
        "history_7d": history_data,
        "prediction_tomorrow": prediction_data
    }


@app.post("/api/bins", tags=["Bins"])
def create_bin(payload: BinCreatePayload, db: Session = Depends(get_db)):
    """Creates a new waste bin in the system."""
    existing = db.query(Bin).filter(Bin.bin_id == payload.bin_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Bin with ID {payload.bin_id} already exists")
    
    new_bin = Bin(
        bin_id=payload.bin_id,
        latitude=payload.latitude,
        longitude=payload.longitude,
        street_name=payload.street_name,
        area_name=payload.area_name,
        ward=payload.ward,
        ward_number=payload.ward_number,
        area_type=payload.area_type,
        capacity=payload.capacity,
        current_fill_percentage=0.0,
        battery_level=100.0,
        signal_strength=90,
        status="Active",
        installation_date=datetime.date.today(),
        last_updated=datetime.datetime.now()
    )
    db.add(new_bin)
    
    # Add an initial prediction log
    pred = Prediction(
        bin_id=payload.bin_id,
        prediction_time=datetime.datetime.now() + datetime.timedelta(hours=24),
        predicted_fill=5.0,
        overflow_probability=0.01,
        model_version="xgboost_v1",
        created_at=datetime.datetime.utcnow()
    )
    db.add(pred)
    db.commit()
    
    return {"status": "success", "message": f"Bin {payload.bin_id} added successfully", "bin_id": payload.bin_id}


@app.put("/api/bins/{bin_id}", tags=["Bins"])
def update_bin(bin_id: str, payload: BinUpdateDetails, db: Session = Depends(get_db)):
    """Updates an existing waste bin's settings and properties."""
    bin_obj = db.query(Bin).filter(Bin.bin_id == bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail=f"Bin {bin_id} not found")
    
    bin_obj.latitude = payload.latitude
    bin_obj.longitude = payload.longitude
    bin_obj.street_name = payload.street_name
    bin_obj.area_name = payload.area_name
    bin_obj.ward = payload.ward
    bin_obj.ward_number = payload.ward_number
    bin_obj.area_type = payload.area_type
    bin_obj.capacity = payload.capacity
    bin_obj.status = payload.status
    bin_obj.last_updated = datetime.datetime.now()
    
    db.commit()
    return {"status": "success", "message": f"Bin {bin_id} updated successfully", "bin_id": bin_id}


# ─────────────────────────────────────────────────────────────
#  NOTIFICATIONS ENDPOINTS
# ─────────────────────────────────────────────────────────────

@app.get("/api/notifications", tags=["Notifications"])
def get_notifications(limit: int = 50, unread_only: bool = False, db: Session = Depends(get_db)):
    """Returns alert feed, sorted by newest first."""
    query = db.query(Notification)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    notifs = query.order_by(Notification.created_at.desc()).limit(limit).all()
    
    return [{
        "notification_id": n.notification_id,
        "bin_id": n.bin_id,
        "severity": n.severity,
        "title": n.title,
        "message": n.message,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat()
    } for n in notifs]


@app.put("/api/notifications/{notification_id}/read", tags=["Notifications"])
def mark_notification_read(notification_id: int, db: Session = Depends(get_db)):
    """Marks a notification as read."""
    notif = db.query(Notification).filter(Notification.notification_id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"status": "ok", "notification_id": notification_id}


@app.put("/api/notifications/mark-all-read", tags=["Notifications"])
def mark_all_notifications_read(db: Session = Depends(get_db)):
    """Marks all notifications as read."""
    db.query(Notification).filter(Notification.is_read == False).update({"is_read": True})
    db.commit()
    return {"status": "ok"}


@app.get("/api/notifications/count", tags=["Notifications"])
def get_notification_count(db: Session = Depends(get_db)):
    """Returns unread notification count."""
    count = db.query(Notification).filter(Notification.is_read == False).count()
    return {"unread_count": count}


# ─────────────────────────────────────────────────────────────
#  SIMULATION CONTROL ENDPOINTS
# ─────────────────────────────────────────────────────────────

@app.post("/api/simulate/start", tags=["Simulation"])
def start_simulation(payload: SimulateControlPayload):
    """
    Starts the IoT simulation engine.
    
    The simulator calls POST /api/bin/update for each bin — identical to what real ESP32 hardware does.
    When real hardware is ready, just stop the simulator and connect the devices.
    """
    speed = payload.speed or 1.0
    started = sim_state.start(speed=speed)
    if not started:
        return {"status": "already_running", "speed": sim_state.speed_multiplier}
    return {"status": "started", "speed": speed, "interval_seconds": sim_state.interval_seconds}


@app.post("/api/simulate/stop", tags=["Simulation"])
def stop_simulation():
    """Stops the IoT simulation engine."""
    sim_state.stop()
    return {"status": "stopped"}


@app.post("/api/simulate/reset", tags=["Simulation"])
def reset_simulation(db: Session = Depends(get_db)):
    """Resets all bin fill levels to 0-15% (simulates mass collection event)."""
    import random
    sim_state.stop()
    bins = db.query(Bin).all()
    for b in bins:
        b.current_fill_percentage = round(random.uniform(2, 15), 1)
        b.last_updated = datetime.datetime.now()
    db.commit()
    return {"status": "reset", "bins_reset": len(bins)}


@app.put("/api/simulate/speed", tags=["Simulation"])
def set_simulation_speed(payload: SimulateControlPayload):
    """Updates the simulation speed multiplier."""
    sim_state.set_speed(payload.speed)
    return {"status": "ok", "speed": payload.speed, "interval_seconds": sim_state.interval_seconds}


@app.get("/api/simulate/status", tags=["Simulation"])
def get_simulation_status():
    """Returns current simulation status."""
    return {
        "running": sim_state.running,
        "speed_multiplier": sim_state.speed_multiplier,
        "interval_seconds": sim_state.interval_seconds
    }


# ─────────────────────────────────────────────────────────────
#  TRUCKS ENDPOINTS
# ─────────────────────────────────────────────────────────────

@app.get("/api/trucks", tags=["Fleet"])
def list_trucks(db: Session = Depends(get_db)):
    """Returns all trucks with status and current assignment."""
    trucks = db.query(Truck).all()
    result = []
    for t in trucks:
        # Get assigned route if any
        today = datetime.date.today()
        route = db.query(OptimizedRoute).filter(
            OptimizedRoute.truck_id == t.truck_id
        ).order_by(OptimizedRoute.created_at.desc()).first()
        
        # Get driver object to get license, phone, etc.
        driver_obj = db.query(Driver).filter(Driver.driver_id == t.driver_id).first()
        
        result.append({
            "truck_id": t.truck_id,
            "plate_number": t.plate_number,
            "capacity": t.capacity,
            "driver": t.driver,
            "driver_id": t.driver_id,
            "driver_phone": driver_obj.phone if driver_obj else "",
            "driver_license": driver_obj.license_number if driver_obj else "",
            "status": t.status,
            "current_latitude": t.current_latitude,
            "current_longitude": t.current_longitude,
            "has_route": route is not None,
            "route_bins": len(json.loads(route.route_path)) - 2 if route else 0
        })
    return result


@app.post("/api/trucks", tags=["Fleet"])
def create_truck(payload: TruckCreatePayload, db: Session = Depends(get_db)):
    """Creates a new collection truck and driver in the system."""
    existing = db.query(Truck).filter(Truck.truck_id == payload.truck_id).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Truck with ID {payload.truck_id} already exists")
    
    # Check if driver exists, otherwise create
    driver = db.query(Driver).filter(Driver.driver_id == payload.driver_id).first()
    if not driver:
        driver = Driver(
            driver_id=payload.driver_id,
            name=payload.driver_name,
            phone=payload.driver_phone,
            license_number=payload.driver_license,
            status="Available"
        )
        db.add(driver)
        db.commit()
    
    new_truck = Truck(
        truck_id=payload.truck_id,
        plate_number=payload.plate_number,
        capacity=payload.capacity,
        driver=payload.driver_name,
        driver_id=payload.driver_id,
        status="Idle"
    )
    db.add(new_truck)
    db.commit()
    
    return {"status": "success", "message": f"Truck {payload.truck_id} added successfully", "truck_id": payload.truck_id}


@app.put("/api/trucks/{truck_id}", tags=["Fleet"])
def update_truck(truck_id: str, payload: TruckUpdateDetails, db: Session = Depends(get_db)):
    """Updates an existing collection truck and driver in the system."""
    truck = db.query(Truck).filter(Truck.truck_id == truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail=f"Truck {truck_id} not found")
    
    # Check if driver exists, otherwise create; if exists, update driver details
    driver = db.query(Driver).filter(Driver.driver_id == payload.driver_id).first()
    if not driver:
        driver = Driver(
            driver_id=payload.driver_id,
            name=payload.driver_name,
            phone=payload.driver_phone,
            license_number=payload.driver_license,
            status="Available"
        )
        db.add(driver)
    else:
        driver.name = payload.driver_name
        if payload.driver_phone is not None:
            driver.phone = payload.driver_phone
        if payload.driver_license is not None:
            driver.license_number = payload.driver_license
            
    db.commit()
    
    # Update truck details
    truck.plate_number = payload.plate_number
    truck.capacity = payload.capacity
    truck.driver = payload.driver_name
    truck.driver_id = payload.driver_id
    truck.status = payload.status
    
    db.commit()
    return {"status": "success", "message": f"Truck {truck_id} updated successfully", "truck_id": truck_id}


class DriverLoginPayload(BaseModel):
    truck_id: str


@app.post("/api/driver/login", tags=["Driver"])
def driver_login(payload: DriverLoginPayload, db: Session = Depends(get_db)):
    """Authenticates a driver using their assigned truck_id."""
    truck = db.query(Truck).filter(Truck.truck_id == payload.truck_id).first()
    if not truck:
        raise HTTPException(status_code=401, detail="Invalid Truck ID")
    
    return {
        "status": "success",
        "truck_id": truck.truck_id,
        "driver": truck.driver,
        "plate_number": truck.plate_number
    }


@app.get("/api/driver/{truck_id}/route", tags=["Driver"])
def get_driver_route(truck_id: str, db: Session = Depends(get_db)):
    """Fetches the latest route for the given truck, including bin details."""
    truck = db.query(Truck).filter(Truck.truck_id == truck_id).first()
    if not truck:
        raise HTTPException(status_code=404, detail="Truck not found")

    route = db.query(OptimizedRoute).filter(
        OptimizedRoute.truck_id == truck_id
    ).order_by(OptimizedRoute.created_at.desc()).first()

    if not route:
        return {"truck_id": truck_id, "has_route": False, "route": None}

    try:
        path = json.loads(route.route_path)
    except Exception:
        path = []

    # Enrich path with bin details if it's a bin
    enriched_path = []
    for node in path:
        if node.get("bin_id") and node["bin_id"] != "DEPOT":
            bin_obj = db.query(Bin).filter(Bin.bin_id == node["bin_id"]).first()
            if bin_obj:
                enriched_path.append({
                    "type": "bin",
                    "bin_id": bin_obj.bin_id,
                    "latitude": bin_obj.latitude,
                    "longitude": bin_obj.longitude,
                    "street_name": bin_obj.street_name,
                    "area_name": bin_obj.area_name,
                    "current_fill_percentage": bin_obj.current_fill_percentage,
                    "status": "Collected" if (bin_obj.current_fill_percentage == 0.0 and bin_obj.status != "Maintenance") else bin_obj.status,
                    "capacity": bin_obj.capacity
                })
        else:
            enriched_path.append({
                "type": "depot",
                "latitude": node.get("latitude", 17.3850),
                "longitude": node.get("longitude", 78.4867)
            })

    return {
        "truck_id": truck_id,
        "has_route": True,
        "route": {
            "route_id": route.route_id,
            "distance_km": route.distance,
            "duration_hours": route.duration,
            "path": enriched_path
        }
    }


# ─────────────────────────────────────────────────────────────
#  DRIVER INTERACTION ENDPOINTS
# ─────────────────────────────────────────────────────────────

class DriverCollectPayload(BaseModel):
    bin_id: str
    truck_id: str


class DriverReportIssuePayload(BaseModel):
    bin_id: str
    issue_type: str
    notes: Optional[str] = None


@app.post("/api/driver/collect", tags=["Driver"])
async def driver_collect(payload: DriverCollectPayload, db: Session = Depends(get_db)):
    """
    ## Driver Bin Collection Endpoint
    
    Triggered when a driver empties a bin. Updates fill levels, sets the status
    to Active, completes the collection request queue, writes history, and broadcasts to dashboard.
    """
    bin_obj = db.query(Bin).filter(Bin.bin_id == payload.bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail=f"Bin {payload.bin_id} not found.")
    
    now = datetime.datetime.now()
    
    # 1. Update bin state
    bin_obj.current_fill_percentage = 0.0
    bin_obj.last_collection_time = now
    bin_obj.status = "Active"
    
    # 2. Complete collection requests
    requests = db.query(CollectionRequest).filter(
        CollectionRequest.bin_id == payload.bin_id,
        CollectionRequest.status.in_(["Pending", "Assigned"])
    ).all()
    for req in requests:
        req.status = "Collected"
        req.collected_at = now
        
    # 3. Append to historical telemetry
    history_entry = FillHistory(
        bin_id=payload.bin_id,
        timestamp=now,
        fill_percentage=0.0,
        battery=bin_obj.battery_level,
        temperature=bin_obj.temperature,
        rainfall=0.0,
        holiday=0
    )
    db.add(history_entry)
    db.commit()
    
    # 4. Broadcast live state change via WebSockets
    ws_message = {
        "type": "bin_update",
        "bin_id": payload.bin_id,
        "fill_percentage": 0.0,
        "battery": bin_obj.battery_level,
        "temperature": bin_obj.temperature,
        "latitude": bin_obj.latitude,
        "longitude": bin_obj.longitude,
        "area_type": bin_obj.area_type,
        "area_name": bin_obj.area_name,
        "ward": bin_obj.ward,
        "street_name": bin_obj.street_name,
        "status": bin_obj.status,
        "timestamp": now.isoformat(),
        "is_critical": False,
        "collected_by": payload.truck_id
    }
    await ws_manager.broadcast(ws_message)
    
    return {
        "status": "success",
        "bin_id": payload.bin_id,
        "message": f"Bin {payload.bin_id} collected successfully by {payload.truck_id}.",
        "timestamp": now.isoformat()
    }


@app.post("/api/driver/report-issue", tags=["Driver"])
async def driver_report_issue(payload: DriverReportIssuePayload, db: Session = Depends(get_db)):
    """
    ## Driver Issue Reporting Endpoint
    
    Flags a bin as requiring Maintenance, generates a system critical notification,
    and broadcasts the maintenance status to all live admin dashboard instances.
    """
    bin_obj = db.query(Bin).filter(Bin.bin_id == payload.bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail=f"Bin {payload.bin_id} not found.")
    
    now = datetime.datetime.now()
    
    # 1. Flag maintenance state
    bin_obj.status = "Maintenance"
    
    # 2. Add system notification
    notif = Notification(
        bin_id=payload.bin_id,
        severity="Critical",
        title=f"Maintenance Alert: Bin {payload.bin_id}",
        message=(
            f"Driver reported '{payload.issue_type}' for bin {payload.bin_id} "
            f"at {bin_obj.street_name} ({bin_obj.area_name}). Notes: {payload.notes or 'None'}."
        ),
        is_read=False,
        created_at=now
    )
    db.add(notif)
    
    # 3. Create a maintenance log entry for the maintenance portal
    priority_map = {
        "Overflow": "High",
        "Damage": "High", 
        "Sensor Fault": "Medium",
        "Fire Hazard": "Critical",
        "Vandalism": "Medium",
        "Smell / Odour": "Low",
        "Other": "Low"
    }
    mlog = MaintenanceLog(
        bin_id=payload.bin_id,
        issue_type=payload.issue_type,
        notes=payload.notes,
        reported_by=getattr(payload, 'truck_id', None),
        priority=priority_map.get(payload.issue_type, "Medium"),
        status="Open",
        reported_at=now
    )
    db.add(mlog)
    
    # Send EmailJS Alert
    asyncio.create_task(asyncio.to_thread(
        send_email_alert,
        heading="🛠️ MAINTENANCE REQUIRED",
        greeting="Attention Maintenance Team,",
        message=f"A driver reported an issue for Bin {payload.bin_id}.",
        details=f"Bin ID: {payload.bin_id}\nLocation: {bin_obj.street_name} ({bin_obj.area_name})\nIssue: {payload.issue_type}\nNotes: {payload.notes or 'None'}\nPriority: {priority_map.get(payload.issue_type, 'Medium')}"
    ))
    
    db.commit()
    
    # 3. Broadcast status change via WebSockets
    ws_message = {
        "type": "bin_update",
        "bin_id": payload.bin_id,
        "fill_percentage": bin_obj.current_fill_percentage,
        "battery": bin_obj.battery_level,
        "temperature": bin_obj.temperature,
        "latitude": bin_obj.latitude,
        "longitude": bin_obj.longitude,
        "area_type": bin_obj.area_type,
        "area_name": bin_obj.area_name,
        "ward": bin_obj.ward,
        "street_name": bin_obj.street_name,
        "status": bin_obj.status,
        "timestamp": now.isoformat(),
        "is_critical": True
    }
    await ws_manager.broadcast(ws_message)
    
    return {
        "status": "success",
        "bin_id": payload.bin_id,
        "message": f"Issue '{payload.issue_type}' reported successfully. Bin marked for maintenance.",
        "timestamp": now.isoformat()
    }



# ─────────────────────────────────────────────────────────────
#  MAINTENANCE PORTAL ENDPOINTS
# ─────────────────────────────────────────────────────────────

class MaintenanceLoginPayload(BaseModel):
    worker_id: str = Field(..., example="MNT001")

class MaintenanceUpdatePayload(BaseModel):
    log_id: int
    status: str = Field(..., example="In Progress")  # In Progress, Resolved
    worker_id: str
    resolution_notes: Optional[str] = None

class MaintenanceCreatePayload(BaseModel):
    bin_id: str
    issue_type: str
    notes: Optional[str] = None
    priority: str = Field("Medium", example="High")
    worker_id: Optional[str] = None


@app.post("/api/maintenance/login", tags=["Maintenance"])
def maintenance_login(payload: MaintenanceLoginPayload, db: Session = Depends(get_db)):
    """Authenticates a maintenance worker by their Worker ID."""
    worker = db.query(MaintenanceWorker).filter(
        MaintenanceWorker.worker_id == payload.worker_id,
        MaintenanceWorker.is_active == True
    ).first()
    if not worker:
        raise HTTPException(status_code=401, detail="Invalid Worker ID or account is inactive.")
    return {
        "status": "success",
        "worker_id": worker.worker_id,
        "name": worker.name,
        "phone": worker.phone,
        "zone": worker.zone,
        "worker_status": worker.status
    }


@app.get("/api/maintenance/jobs", tags=["Maintenance"])
def get_maintenance_jobs(
    worker_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Returns all maintenance jobs, optionally filtered by worker or status."""
    query = db.query(MaintenanceLog)
    if worker_id:
        query = query.filter(MaintenanceLog.worker_id == worker_id)
    if status:
        query = query.filter(MaintenanceLog.status == status)
    logs = query.order_by(MaintenanceLog.reported_at.desc()).limit(200).all()
    
    result = []
    for log in logs:
        bin_obj = db.query(Bin).filter(Bin.bin_id == log.bin_id).first()
        worker_obj = db.query(MaintenanceWorker).filter(MaintenanceWorker.worker_id == log.worker_id).first() if log.worker_id else None
        result.append({
            "log_id": log.log_id,
            "bin_id": log.bin_id,
            "bin_street": bin_obj.street_name if bin_obj else "Unknown",
            "bin_area": bin_obj.area_name if bin_obj else "Unknown",
            "bin_ward": bin_obj.ward if bin_obj else "Unknown",
            "bin_lat": bin_obj.latitude if bin_obj else None,
            "bin_lon": bin_obj.longitude if bin_obj else None,
            "bin_fill": bin_obj.current_fill_percentage if bin_obj else 0,
            "bin_battery": bin_obj.battery_level if bin_obj else 0,
            "issue_type": log.issue_type,
            "notes": log.notes,
            "priority": log.priority,
            "status": log.status,
            "reported_by": log.reported_by,
            "worker_id": log.worker_id,
            "worker_name": worker_obj.name if worker_obj else None,
            "reported_at": log.reported_at.isoformat(),
            "assigned_at": log.assigned_at.isoformat() if log.assigned_at else None,
            "resolved_at": log.resolved_at.isoformat() if log.resolved_at else None,
            "resolution_notes": log.resolution_notes,
        })
    return result


@app.put("/api/maintenance/jobs/{log_id}", tags=["Maintenance"])
async def update_maintenance_job(log_id: int, payload: MaintenanceUpdatePayload, db: Session = Depends(get_db)):
    """Updates a maintenance job status. Resolving a job restores the bin to Active."""
    log = db.query(MaintenanceLog).filter(MaintenanceLog.log_id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Maintenance log not found.")
    
    now = datetime.datetime.now()
    log.status = payload.status
    log.worker_id = payload.worker_id
    
    if payload.status == "In Progress" and not log.assigned_at:
        log.assigned_at = now
        # Update worker status
        worker = db.query(MaintenanceWorker).filter(MaintenanceWorker.worker_id == payload.worker_id).first()
        if worker:
            worker.status = "On Job"
    
    if payload.status == "Resolved":
        log.resolved_at = now
        log.resolution_notes = payload.resolution_notes
        
        # Restore bin to Active
        bin_obj = db.query(Bin).filter(Bin.bin_id == log.bin_id).first()
        if bin_obj:
            bin_obj.status = "Active"
            bin_obj.last_updated = now
        
        # Free up worker
        worker = db.query(MaintenanceWorker).filter(MaintenanceWorker.worker_id == payload.worker_id).first()
        if worker:
            # Check if other open jobs assigned to this worker
            open_jobs = db.query(MaintenanceLog).filter(
                MaintenanceLog.worker_id == payload.worker_id,
                MaintenanceLog.status == "In Progress",
                MaintenanceLog.log_id != log_id
            ).count()
            if open_jobs == 0:
                worker.status = "Available"
        
        # Notify via WebSocket
        if bin_obj:
            ws_message = {
                "type": "bin_update",
                "bin_id": bin_obj.bin_id,
                "fill_percentage": bin_obj.current_fill_percentage,
                "battery": bin_obj.battery_level,
                "temperature": bin_obj.temperature,
                "latitude": bin_obj.latitude,
                "longitude": bin_obj.longitude,
                "area_type": bin_obj.area_type,
                "area_name": bin_obj.area_name,
                "ward": bin_obj.ward,
                "street_name": bin_obj.street_name,
                "status": "Active",
                "timestamp": now.isoformat(),
                "is_critical": False
            }
            await ws_manager.broadcast(ws_message)
    
    db.commit()
    return {"status": "success", "log_id": log_id, "new_status": payload.status}


@app.post("/api/maintenance/jobs", tags=["Maintenance"])
def create_maintenance_job(payload: MaintenanceCreatePayload, db: Session = Depends(get_db)):
    """Creates a new maintenance job manually (e.g., by admin or field inspection)."""
    bin_obj = db.query(Bin).filter(Bin.bin_id == payload.bin_id).first()
    if not bin_obj:
        raise HTTPException(status_code=404, detail=f"Bin {payload.bin_id} not found.")
    
    log = MaintenanceLog(
        bin_id=payload.bin_id,
        worker_id=payload.worker_id,
        issue_type=payload.issue_type,
        notes=payload.notes,
        priority=payload.priority,
        status="Open",
        reported_at=datetime.datetime.now(),
        assigned_at=datetime.datetime.now() if payload.worker_id else None
    )
    db.add(log)
    bin_obj.status = "Maintenance"
    db.commit()
    return {"status": "success", "log_id": log.log_id, "bin_id": payload.bin_id}


@app.get("/api/maintenance/stats", tags=["Maintenance"])
def get_maintenance_stats(db: Session = Depends(get_db)):
    """Returns maintenance KPI statistics."""
    today = datetime.date.today()
    today_start = datetime.datetime.combine(today, datetime.time.min)
    
    total_open = db.query(MaintenanceLog).filter(MaintenanceLog.status == "Open").count()
    in_progress = db.query(MaintenanceLog).filter(MaintenanceLog.status == "In Progress").count()
    resolved_today = db.query(MaintenanceLog).filter(
        MaintenanceLog.status == "Resolved",
        MaintenanceLog.resolved_at >= today_start
    ).count()
    total_resolved = db.query(MaintenanceLog).filter(MaintenanceLog.status == "Resolved").count()
    bins_in_maintenance = db.query(Bin).filter(Bin.status == "Maintenance").count()
    total_workers = db.query(MaintenanceWorker).filter(MaintenanceWorker.is_active == True).count()
    workers_on_job = db.query(MaintenanceWorker).filter(MaintenanceWorker.status == "On Job").count()
    
    # Average resolution time
    resolved_logs = db.query(MaintenanceLog).filter(
        MaintenanceLog.status == "Resolved",
        MaintenanceLog.resolved_at != None,
        MaintenanceLog.reported_at != None
    ).all()
    avg_hours = 0.0
    if resolved_logs:
        total_secs = sum((l.resolved_at - l.reported_at).total_seconds() for l in resolved_logs if l.resolved_at)
        avg_hours = round(total_secs / len(resolved_logs) / 3600, 1)
    
    return {
        "total_open": total_open,
        "in_progress": in_progress,
        "resolved_today": resolved_today,
        "total_resolved": total_resolved,
        "bins_in_maintenance": bins_in_maintenance,
        "total_workers": total_workers,
        "workers_on_job": workers_on_job,
        "avg_resolution_hours": avg_hours
    }


@app.get("/api/maintenance/workers", tags=["Maintenance"])
def list_maintenance_workers(db: Session = Depends(get_db)):
    """Returns all maintenance workers with their current job counts."""
    workers = db.query(MaintenanceWorker).filter(MaintenanceWorker.is_active == True).all()
    result = []
    for w in workers:
        open_jobs = db.query(MaintenanceLog).filter(
            MaintenanceLog.worker_id == w.worker_id,
            MaintenanceLog.status.in_(["Open", "In Progress"])
        ).count()
        resolved_total = db.query(MaintenanceLog).filter(
            MaintenanceLog.worker_id == w.worker_id,
            MaintenanceLog.status == "Resolved"
        ).count()
        result.append({
            "worker_id": w.worker_id,
            "name": w.name,
            "phone": w.phone,
            "zone": w.zone,
            "status": w.status,
            "open_jobs": open_jobs,
            "resolved_total": resolved_total
        })
    return result


@app.get("/api/maintenance/bins", tags=["Maintenance"])
def get_maintenance_bins(db: Session = Depends(get_db)):
    """Returns all bins currently in Maintenance status with their latest open log."""
    bins = db.query(Bin).filter(Bin.status == "Maintenance").all()
    result = []
    for b in bins:
        latest_log = db.query(MaintenanceLog).filter(
            MaintenanceLog.bin_id == b.bin_id,
            MaintenanceLog.status.in_(["Open", "In Progress"])
        ).order_by(MaintenanceLog.reported_at.desc()).first()
        result.append({
            "bin_id": b.bin_id,
            "street_name": b.street_name,
            "area_name": b.area_name,
            "ward": b.ward,
            "latitude": b.latitude,
            "longitude": b.longitude,
            "current_fill_percentage": b.current_fill_percentage,
            "battery_level": b.battery_level,
            "issue_type": latest_log.issue_type if latest_log else "Unknown",
            "priority": latest_log.priority if latest_log else "Medium",
            "log_id": latest_log.log_id if latest_log else None,
            "log_status": latest_log.status if latest_log else None,
            "reported_at": latest_log.reported_at.isoformat() if latest_log else None,
            "worker_id": latest_log.worker_id if latest_log else None,
        })
    return result


# ─────────────────────────────────────────────────────────────
#  ML PIPELINE ENDPOINTS
# ─────────────────────────────────────────────────────────────

@app.post("/api/generate-data", tags=["Admin"])
def trigger_data_generation(background_tasks: BackgroundTasks):
    """Triggers historical synthetic data generation (100 bins × 365 days). Takes 2-5 minutes."""
    background_tasks.add_task(run_generation)
    return {"message": "Data generation started in background. This may take 2-5 minutes."}


@app.post("/api/train", tags=["ML"])
def trigger_model_training(background_tasks: BackgroundTasks):
    """Triggers XGBoost model training and evaluation in the background."""
    background_tasks.add_task(train_and_evaluate_models)
    return {"message": "Model training started in background. Check /api/analytics for results."}


@app.get("/api/predictions", tags=["ML"])
def list_predictions(db: Session = Depends(get_db)):
    """Returns 24h predictions for all bins, sorted by overflow probability."""
    preds = db.query(Prediction, Bin)\
        .join(Bin, Prediction.bin_id == Bin.bin_id)\
        .order_by(Prediction.overflow_probability.desc())\
        .all()
    
    return [{
        "bin_id": b.bin_id,
        "latitude": b.latitude,
        "longitude": b.longitude,
        "street_name": b.street_name,
        "area_name": b.area_name,
        "ward": b.ward,
        "area_type": b.area_type,
        "capacity": b.capacity,
        "current_fill_percentage": round(b.current_fill_percentage or 0.0, 1),
        "predicted_fill": round(pred.predicted_fill, 1),
        "overflow_probability": round(pred.overflow_probability * 100, 1),
        "priority_score": calculate_priority(pred.predicted_fill, pred.overflow_probability, b.area_type)
    } for pred, b in preds]


@app.post("/api/predict", tags=["ML"])
def generate_predictions(db: Session = Depends(get_db)):
    """
    Runs the trained XGBoost model to forecast fill levels 24 hours ahead.
    Results stored in predictions table.
    """
    model_path = os.path.join(os.path.dirname(__file__), "..", "ml", "models", "xgb_model.pkl")
    meta_path = os.path.join(os.path.dirname(__file__), "..", "ml", "models", "model_metadata.json")

    if not os.path.exists(model_path) or not os.path.exists(meta_path):
        raise HTTPException(
            status_code=400,
            detail="ML model not found. Train models first via POST /api/train."
        )

    with open(model_path, "rb") as f:
        model = pickle.load(f)
    with open(meta_path, "r") as f:
        metadata = json.load(f)

    feature_cols = metadata["features"]
    area_cols = metadata["area_cols"]
    rmse = metadata["rmse"]

    max_timestamp = db.query(func.max(FillHistory.timestamp)).scalar()
    if not max_timestamp:
        raise HTTPException(status_code=400, detail="No historical data found. Run /api/generate-data first.")

    start_date = max_timestamp - datetime.timedelta(days=3)
    query = f"""
        SELECT fh.timestamp, fh.bin_id, fh.fill_percentage, fh.temperature,
               fh.rainfall, fh.holiday, fh.population_density, fh.waste_generated,
               b.capacity, b.area_type
        FROM fill_history fh
        JOIN bins b ON fh.bin_id = b.bin_id
        WHERE fh.timestamp >= '{start_date.isoformat()}'
    """
    df = pd.read_sql(query, con=engine)
    df['timestamp'] = pd.to_datetime(df['timestamp'])

    df_features = build_features(df, is_training=False)
    latest_indices = df_features.groupby('bin_id')['timestamp'].idxmax()
    df_latest = df_features.loc[latest_indices].copy()

    if len(df_latest) == 0:
        raise HTTPException(status_code=500, detail="Failed to compute feature sets.")

    pred_times = df_latest['timestamp'] + pd.Timedelta(hours=24)
    df_latest['timestamp'] = pred_times
    df_latest['hour'] = df_latest['timestamp'].dt.hour
    df_latest['day_of_week'] = df_latest['timestamp'].dt.dayofweek
    df_latest['month'] = df_latest['timestamp'].dt.month
    df_latest['is_weekend'] = (df_latest['day_of_week'] >= 5).astype(int)
    df_latest['holiday'] = df_latest['is_weekend']

    for col in area_cols:
        area_name = col.replace("area_", "")
        df_latest[col] = (df_latest['area_type'] == area_name).astype(int)

    X_pred = df_latest[feature_cols]
    predictions = np.clip(model.predict(X_pred), 0.0, 100.0)

    db.query(Prediction).delete()

    for bin_id, pred_time, pred_fill in zip(df_latest['bin_id'], pred_times, predictions):
        overflow_prob = calculate_overflow_probability(pred_fill, rmse, threshold=80.0)
        pred_obj = Prediction(
            bin_id=bin_id,
            prediction_time=pred_time.to_pydatetime(),
            predicted_fill=float(pred_fill),
            overflow_probability=overflow_prob
        )
        db.add(pred_obj)

    db.commit()
    return {"message": f"Generated predictions for {len(df_latest)} bins."}


# ─────────────────────────────────────────────────────────────
#  ROUTE OPTIMIZATION ENDPOINTS
# ─────────────────────────────────────────────────────────────

@app.post("/api/optimize", tags=["Routing"])
def optimize_routes(db: Session = Depends(get_db)):
    """
    Identifies critical bins (fill >= 80% OR priority >= 75) and computes
    optimized collection routes using Google OR-Tools CVRP.
    """
    preds = db.query(Prediction, Bin).join(Bin, Prediction.bin_id == Bin.bin_id).all()

    if not preds:
        generate_predictions(db)
        preds = db.query(Prediction, Bin).join(Bin, Prediction.bin_id == Bin.bin_id).all()

    bins_to_collect = []
    for pred, b in preds:
        priority = calculate_priority(pred.predicted_fill, pred.overflow_probability, b.area_type)
        if pred.predicted_fill >= 80.0 or priority >= 75.0:
            bins_to_collect.append({
                "bin_id": b.bin_id,
                "latitude": b.latitude,
                "longitude": b.longitude,
                "capacity": b.capacity,
                "current_fill_liters": b.capacity * (pred.predicted_fill / 100.0)
            })

    truck_fleet_objs = db.query(Truck).filter(Truck.status.in_(["Idle", "Active"])).all()
    truck_fleet = [
        {"truck_id": t.truck_id, "capacity": t.capacity, "driver": t.driver}
        for t in truck_fleet_objs
    ]

    if not truck_fleet:
        raise HTTPException(status_code=500, detail="No active trucks available.")

    # Depot = GHMC Headquarters, Hyderabad
    depot_coords = {"latitude": 17.3850, "longitude": 78.4867}

    results = solve_cvrp(depot_coords, bins_to_collect, truck_fleet)

    db.query(OptimizedRoute).delete()
    today = datetime.date.today()

    for truck_id, route_info in results.get("routes", {}).items():
        route_path_str = json.dumps(route_info["path"])
        opt_route = OptimizedRoute(
            truck_id=truck_id,
            date=today,
            distance=route_info["distance_km"],
            fuel=round(route_info["distance_km"] * 0.3, 2),
            duration=round((route_info["distance_km"] / 30.0) + (len(route_info["path"]) * 10 / 60.0), 2),
            route_path=route_path_str
        )
        db.add(opt_route)

    db.commit()

    return {
        "message": f"Optimized routes for {len(results.get('routes', {}))} trucks. {len(bins_to_collect)} bins scheduled.",
        "metrics": results
    }


@app.get("/api/routes", tags=["Routing"])
def get_routes(db: Session = Depends(get_db)):
    """Returns today's optimized collection routes with full stop sequences."""
    routes = db.query(OptimizedRoute, Truck)\
        .join(Truck, OptimizedRoute.truck_id == Truck.truck_id)\
        .order_by(OptimizedRoute.created_at.desc())\
        .all()

    result = []
    for r, t in routes:
        try:
            path = json.loads(r.route_path)
        except Exception:
            path = []
        result.append({
            "route_id": r.route_id,
            "truck_id": t.truck_id,
            "plate_number": t.plate_number,
            "driver": t.driver,
            "distance_km": r.distance,
            "fuel_liters": r.fuel,
            "duration_hours": r.duration,
            "path": path
        })
    return result


# ─────────────────────────────────────────────────────────────
#  ANALYTICS ENDPOINT
# ─────────────────────────────────────────────────────────────

@app.get("/api/analytics", tags=["Analytics"])
def get_analytics(db: Session = Depends(get_db)):
    """Returns system analytics: savings, ML metrics, bin stats, and area breakdown."""
    # Try to load experiment results for comparison
    exp_file = os.path.join(os.path.dirname(__file__), "..", "experiments", "results", "aggregate_results.csv")
    comparison = {}
    if os.path.exists(exp_file):
        try:
            df_agg = pd.read_csv(exp_file, index_col=0) # index is Strategy
            if "Full EcoBin" in df_agg.index and "Fixed" in df_agg.index:
                comparison = {
                    "AI": {
                        "distance_km": float(df_agg.loc["Full EcoBin", "Distance_km_mean"]),
                        "fuel_liters": float(df_agg.loc["Full EcoBin", "Fuel_Liters_mean"]),
                        "overflow_bins": float(df_agg.loc["Full EcoBin", "Overflow_Events_mean"]),
                        "truck_utilization_pct": float(df_agg.loc["Full EcoBin", "Utilization_pct_mean"]),
                        "duration_hours": round(float(df_agg.loc["Full EcoBin", "Distance_km_mean"]) / 30.0, 1)
                    },
                    "Fixed": {
                        "distance_km": float(df_agg.loc["Fixed", "Distance_km_mean"]),
                        "fuel_liters": float(df_agg.loc["Fixed", "Fuel_Liters_mean"]),
                        "overflow_bins": float(df_agg.loc["Fixed", "Overflow_Events_mean"]),
                        "truck_utilization_pct": float(df_agg.loc["Fixed", "Utilization_pct_mean"]),
                        "duration_hours": round(float(df_agg.loc["Fixed", "Distance_km_mean"]) / 30.0, 1)
                    }
                }
        except Exception as e:
            print(f"Error loading experiment results: {e}")

    # Fallback to zero if not run yet
    if not comparison:
        comparison = {
            "AI": {"distance_km": 0, "fuel_liters": 0, "overflow_bins": 0, "duration_hours": 0, "truck_utilization_pct": 0, "bins_collected": 0},
            "Fixed": {"distance_km": 0, "fuel_liters": 0, "overflow_bins": 0, "duration_hours": 0, "truck_utilization_pct": 0, "bins_collected": 0}
        }

    distance_saved = max(0.0, comparison["Fixed"]["distance_km"] - comparison["AI"]["distance_km"])
    fuel_saved = max(0.0, comparison["Fixed"]["fuel_liters"] - comparison["AI"]["fuel_liters"])
    co2_saved = round(fuel_saved * 2.68, 2)

    meta_path = os.path.join(os.path.dirname(__file__), "..", "ml", "models", "model_metadata.json")
    ml_metrics = None
    if os.path.exists(meta_path):
        with open(meta_path, "r") as f:
            ml_metrics = json.load(f)["results"]

    avg_fill = db.query(func.avg(Bin.current_fill_percentage)).scalar()
    total_bins = db.query(Bin).count()
    active_bins = db.query(Bin).filter(Bin.status == "Active").count()
    overflowing = db.query(Bin).filter(Bin.current_fill_percentage >= 80).count()
    critical_predictions = db.query(Prediction).filter(Prediction.predicted_fill >= 80).count()
    unread_notifs = db.query(Notification).filter(Notification.is_read == False).count()

    area_breakdown = []
    breakdown_data = db.query(Bin.area_type, func.sum(FillHistory.waste_generated))\
        .join(FillHistory, Bin.bin_id == FillHistory.bin_id)\
        .group_by(Bin.area_type)\
        .all()
    for area, total in breakdown_data:
        area_breakdown.append({
            "area_type": area,
            "waste_tons": round((total or 0) / 1000.0, 2)
        })

    return {
        "comparison": comparison,
        "savings": {
            "distance_km": round(distance_saved, 1),
            "fuel_liters": round(fuel_saved, 1),
            "co2_kg": co2_saved
        },
        "ml_evaluation": ml_metrics,
        "system_stats": {
            "average_fill_percentage": round(avg_fill or 0.0, 1),
            "total_bins": total_bins,
            "active_bins": active_bins,
            "overflowing_bins": overflowing,
            "critical_predictions": critical_predictions,
            "total_trucks": db.query(Truck).count(),
            "active_trucks": db.query(Truck).filter(Truck.status.in_(["Idle", "En Route"])).count(),
            "unread_notifications": unread_notifs,
            "simulation_running": sim_state.running,
            "simulation_speed": sim_state.speed_multiplier,
        },
        "area_breakdown": area_breakdown
    }


# ─────────────────────────────────────────────────────────────
#  REPORTS ENDPOINT
# ─────────────────────────────────────────────────────────────

@app.get("/api/reports/daily", tags=["Reports"])
def daily_report(db: Session = Depends(get_db)):
    """Returns today's collection summary report."""
    today = datetime.date.today()
    routes = db.query(OptimizedRoute).filter(OptimizedRoute.date == today).all()
    
    total_distance = sum(r.distance for r in routes)
    total_fuel = sum(r.fuel for r in routes)
    total_duration = sum(r.duration for r in routes)
    
    bins_today = 0
    for r in routes:
        try:
            path = json.loads(r.route_path)
            bins_today += max(0, len(path) - 2)  # Subtract 2 depots
        except Exception:
            pass
    
    return {
        "date": today.isoformat(),
        "routes_count": len(routes),
        "bins_collected": bins_today,
        "total_distance_km": round(total_distance, 1),
        "total_fuel_liters": round(total_fuel, 1),
        "total_duration_hours": round(total_duration, 1),
        "co2_emitted_kg": round(total_fuel * 2.68, 1),
        "collection_efficiency_pct": round((bins_today / 100.0) * 100, 1) if bins_today else 0
    }


# ─────────────────────────────────────────────────────────────
#  QR SMART IDENTITY SYSTEM
# ─────────────────────────────────────────────────────────────
import uuid

class QRGeneratePayload(BaseModel):
    entity_type: str
    entity_id: str

class QRScanPayload(BaseModel):
    token: str

@app.post("/api/qr/generate", tags=["QR Identity"])
def generate_qr(payload: QRGeneratePayload, db: Session = Depends(get_db)):
    """Generates a secure QR token for a system entity."""
    token = str(uuid.uuid4())
    
    # Invalidate previous active tokens for this entity
    db.query(QRCode).filter(
        QRCode.entity_type == payload.entity_type,
        QRCode.entity_id == payload.entity_id,
        QRCode.is_active == True
    ).update({"is_active": False})
    
    qr_id = f"QR-{str(uuid.uuid4())[:8].upper()}"
    new_qr = QRCode(
        qr_id=qr_id,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        token=token,
        is_active=True
    )
    db.add(new_qr)
    db.commit()
    
    return {"status": "success", "qr_id": qr_id, "token": token}

@app.post("/api/qr/scan", tags=["QR Identity"])
def scan_qr(payload: QRScanPayload, db: Session = Depends(get_db)):
    """Validates a QR token and returns the context for the frontend."""
    qr_code = db.query(QRCode).filter(QRCode.token == payload.token).first()
    
    if not qr_code or not qr_code.is_active:
        raise HTTPException(status_code=401, detail="Invalid or expired QR token")
        
    # Build a context response based on entity_type
    context = {
        "status": "success",
        "entity_type": qr_code.entity_type,
        "entity_id": qr_code.entity_id
    }
    
    if qr_code.entity_type == "Driver":
        driver = db.query(Driver).filter(Driver.driver_id == qr_code.entity_id).first()
        if driver:
            context["driver_name"] = driver.name
            context["language"] = getattr(driver, "language", "en")
            # Optional: Find assigned truck
            truck = db.query(Truck).filter(Truck.driver_id == driver.driver_id).first()
            if truck:
                context["truck_id"] = truck.truck_id
                
    elif qr_code.entity_type == "Worker":
        worker = db.query(MaintenanceWorker).filter(MaintenanceWorker.worker_id == qr_code.entity_id).first()
        if worker:
            context["worker_name"] = worker.name
            context["language"] = getattr(worker, "language", "en")
            
    elif qr_code.entity_type == "Truck":
        truck = db.query(Truck).filter(Truck.truck_id == qr_code.entity_id).first()
        if truck:
            context["plate_number"] = truck.plate_number
            context["status"] = truck.status
            
    elif qr_code.entity_type == "Bin":
        bin_obj = db.query(Bin).filter(Bin.bin_id == qr_code.entity_id).first()
        if bin_obj:
            context["location"] = f"{bin_obj.street_name}, {bin_obj.area_name}"
            context["status"] = bin_obj.status
            
    return context

@app.get("/api/qr/token/{entity_type}/{entity_id}", tags=["QR Identity"])
def get_qr_token(entity_type: str, entity_id: str, db: Session = Depends(get_db)):
    """Fetches the active QR token for an entity, or generates a new one if none exists."""
    if entity_type == "Driver" and not entity_id.startswith("DR-"):
        driver = db.query(Driver).filter(Driver.name == entity_id).first()
        if driver:
            entity_id = driver.driver_id

    qr_code = db.query(QRCode).filter(
        QRCode.entity_type == entity_type,
        QRCode.entity_id == entity_id,
        QRCode.is_active == True
    ).first()
    
    if qr_code:
        return {"status": "success", "token": qr_code.token}
    
    # Generate new if none exists
    token = str(uuid.uuid4())
    qr_id = f"QR-{str(uuid.uuid4())[:8].upper()}"
    new_qr = QRCode(
        qr_id=qr_id,
        entity_type=entity_type,
        entity_id=entity_id,
        token=token,
        is_active=True
    )
    db.add(new_qr)
    db.commit()
    
    return {"status": "success", "token": token}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
