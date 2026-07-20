# 09 Documentation

## 1. User Guide (Municipal Operators)

### 1.1 Dashboard Overview
The EcoBin dashboard is designed for ease of use in a municipal control room.
- **The Map:** The central view displays your city's bins. Red markers indicate bins that are predicted to overflow within 24 hours. Green markers represent healthy bins.
- **Analytics Panel:** Located on the side, this panel compares the AI-Optimized performance against a standard Fixed Schedule. Watch the "Fuel Saved" and "Distance Saved" metrics to quantify operational efficiency.
- **Route Viewer:** Click on a truck in the sidebar to overlay its optimized route on the map. The polyline shows the exact path the driver will take.

### 1.2 IoT Alerts
If a hardware node detects tampering (via PIR sensor), the dashboard will display a push notification, and the specific bin's marker will pulse on the map.

## 2. Developer Guide

### 2.1 Local Environment Setup
To contribute to the EcoBin project locally without Docker:
1. Create a virtual environment: `python -m venv .venv`
2. Activate it and install dependencies: `pip install -r requirements.txt`
3. Run the setup pipeline to generate the database and ML models: `python run_pipeline.py`
4. Start the backend: `python -m uvicorn backend.main:app --reload`
5. In a separate terminal, start the frontend: `cd frontend && npm run dev`

### 2.2 Adding New Sensors to Wokwi
To add a new sensor (e.g., a GPS module) to the simulation:
1. Open `diagram.json` and add the component definition.
2. Wire the connections array to the ESP32 pins.
3. Update the `POST` payload in the Arduino code to include the new metric.
4. Modify `database/models.py` in the backend to store the new field.
