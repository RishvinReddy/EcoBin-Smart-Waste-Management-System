# Requirement Traceability Matrix (RTM)

| Req ID | Requirement Description | Implementation Module | Test Case ID | Status |
| :--- | :--- | :--- | :--- | :--- |
| **FR-01** | API must receive IoT payloads via POST. | `backend/main.py` | TC-01 | Done |
| **FR-02** | Payload must be saved to `fill_history` DB table. | `database/models.py` | TC-02 | Done |
| **FR-03** | Forecast next 24 hours fill level using ML. | `ml/forecasting/models.py` | TC-03 | Done |
| **FR-04** | Calculate overflow probability via RMSE CDF. | `ml/forecasting/models.py` | TC-04 | Done |
| **FR-05** | Compute route visiting bins with priority > 0.70. | `optimization/vrp_solver/`| TC-05 | Done |
| **FR-06** | Total route load must not exceed Truck capacity. | `optimization/vrp_solver/`| TC-06 | Done |
| **FR-07** | Render bins on Leaflet map. | `frontend/src/components/Map` | TC-07 | Done |
| **FR-08** | Render dynamic optimized path on map. | `frontend/src/components/Map` | TC-08 | Done |
| **HR-01** | Wokwi ESP32 sends HC-SR04 distance over HTTP. | `hardware/wokwi.ino` | TC-09 | Done |
