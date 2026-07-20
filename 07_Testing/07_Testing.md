# 07 Testing

## 1. Testing Strategy

The EcoBin system employs a multi-tiered testing strategy to ensure reliability across hardware simulations, algorithmic models, backend APIs, and the frontend dashboard.

## 2. Machine Learning Validation
- **Hold-out Validation:** 20% of the synthesized dataset (approx. 876,000 records) is reserved for testing.
- **Metrics Evaluated:** Root Mean Squared Error (RMSE) and Mean Absolute Error (MAE) are calculated for the XGBoost forecasts.
- **Probability Verification:** The computed overflow probability is tested against a Confusion Matrix to verify Precision (minimizing false positives to save fuel) and Recall (minimizing false negatives to prevent overflows).

## 3. Backend API Testing (FastAPI)
- **Framework:** `pytest` combined with FastAPI's `TestClient`.
- **Unit Tests:** Ensure CRUD operations on the SQLAlchemy `models.py` execute correctly in an isolated, in-memory SQLite database.
- **Integration Tests:** Verify that the POST payload from the IoT simulator correctly writes to the `fill_history` table and triggers a prediction update.

## 4. Optimization Testing
- **Heuristic Constraints:** The OR-Tools CVRP output is mathematically validated to ensure that no generated route exceeds the `Truck.capacity` limit, and all bins above the priority threshold are visited.

## 5. Hardware-in-the-Loop (HIL) Simulation
- **Wokwi Validation:** Manual trigger testing inside the Wokwi simulation environment to verify that adjusting the distance slider on the HC-SR04 correctly updates the LCD output and successfully sends the HTTP POST payload to the local backend.
