# Software Design Specification (SDS)

## 1. Decoupled 3-Tier Architecture

```mermaid
graph TD
    A[Edge Tier: Wokwi ESP32] -->|JSON POST| B[Core Tier: FastAPI]
    B <--> C[(PostgreSQL DB)]
    B <--> D[AI: XGBoost & OR-Tools]
    E[Presentation Tier: React] -->|GET Polling| B
```

## 2. Component Specifications

| Component | File / Module | Responsibility |
| :--- | :--- | :--- |
| **Forecaster**| `forecasting.py` | Reads 7-day history, applies XGBoost, outputs `predicted_fill`. |
| **Solver** | `solver.py` | Maps 2D Haversine matrix, applies `CapacityConstraint`, outputs route. |
| **Data Gen** | `generate.py` | Synthesizes 4.38M rows of historical waste data. |
| **Dashboard** | `App.tsx` | Renders the React-Leaflet map and API analytics. |
