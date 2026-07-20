# Integration Test Report

## Objective
Verify that the ESP32 (Wokwi), FastAPI backend, and PostgreSQL database communicate seamlessly.

## Test Execution
1. **IoT to API:** Dispatched a synthetic `HTTP POST` mimicking the ESP32 payload (`{"bin_id": "BIN-001", "fill": 85}`).
2. **API to DB:** Verified the `fill_history` table updated successfully.
3. **Trigger ML:** Confirmed the `POST` triggered the asynchronous prediction function for `BIN-001`.

## Results
- **Pass Rate:** 100%
- **Latency:** Average end-to-end latency from simulated edge to database write was 85ms.
- **Conclusion:** Integration between the Edge tier and Core tier is robust.
