# 05 Software

## 1. Backend Application (FastAPI)

The backend acts as the central nervous system of EcoBin.
- **RESTful Endpoints:** Serves JSON payloads to the frontend dashboard.
- **Dependency Injection:** Utilizes FastAPI's robust dependency injection for secure database connection pooling via SQLAlchemy.
- **Swagger Documentation:** Auto-generates interactive API docs at `/docs`.

## 2. Machine Learning Pipeline (Python)

Located in the `ml/` directory, the ML pipeline executes in three stages:
1. **Data Generation:** `generator.py` synthesizes hourly activity models for 500 bins based on realistic area types (Commercial, Residential). It creates ~4.38M records.
2. **Feature Engineering:** `features.py` extracts rolling averages, time lags, and detects historical collection patterns.
3. **Forecasting:** `models.py` trains an XGBoost model. It calculates standard error and maps it to a cumulative density function to compute a precise probability of the bin overflowing.

## 3. Route Optimization (Operations Research)

Located in `optimization/vrp_solver/`.
- Converts the list of high-priority bins into a Capacitated Vehicle Routing Problem (CVRP).
- Uses **Google OR-Tools** (C++ backend with Python bindings) to find the optimal path that minimizes distance while ensuring the total waste collected on the route does not exceed truck capacities.

## 4. Frontend Dashboard (React + TypeScript)

- **Map Component:** Uses `react-leaflet` to render a dark-themed map tileset. Bins are rendered as interactive markers. Red = High Priority, Green = Normal.
- **Routing Line:** Renders GeoJSON Polylines representing the optimized OR-Tools route.
- **Analytics Panel:** Displays live KPIs comparing distance traveled and fuel saved versus a traditional fixed schedule.
