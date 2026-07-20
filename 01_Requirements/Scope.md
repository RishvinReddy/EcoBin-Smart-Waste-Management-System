# Scope

## 1. Scope Boundary

```mermaid
stateDiagram-v2
    [*] --> In_Scope
    [*] --> Out_Of_Scope
    
    state In_Scope {
        Hardware_Simulation
        FastAPI_Backend
        XGBoost_Forecasting
        OR_Tools_Routing
        React_Dashboard
    }
    
    state Out_Of_Scope {
        Physical_Hardware_Deployment
        Driver_Mobile_App
        Live_Traffic_Integration
    }
```

## 2. Detailed Scope Definition

| Feature / Domain | In Scope | Out of Scope | Notes |
| :--- | :--- | :--- | :--- |
| **Hardware** | Wokwi ESP32 Simulation. | Physical deployment in municipal bins. | Cost constraints limit physical rollout for Phase 1. |
| **Data Pipeline** | FastAPI REST backend, SQLite/PostgreSQL, 4.38M synthetic records. | External data lake integration (e.g., Snowflake). | Built for vertical scaling initially. |
| **Machine Learning** | XGBoost time-series forecasting (24 hours ahead). | Computer vision/camera-based fill detection. | Relies solely on ultrasonic distance telemetry. |
| **Routing Optimization** | OR-Tools CVRP solver using Haversine distance matrix. | Live traffic APIs (e.g., Google Maps Traffic delays). | Haversine provides a sufficient baseline for proof-of-concept. |
| **Frontend UI** | React + Leaflet control room dashboard. | Dedicated iOS/Android app for truck drivers. | Route paths are currently exported as JSON for dispatch. |
