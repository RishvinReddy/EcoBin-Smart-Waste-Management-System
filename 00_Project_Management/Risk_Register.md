# Risk Register

| ID | Risk Description | Probability | Impact | Mitigation Strategy | Owner |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **R01** | Wokwi hardware simulation fails to sync with local backend. | Medium | High | Ensure local IP and port are correctly mapped in the `wokwi.toml` network config. | IoT Lead |
| **R02** | XGBoost model heavily overfits the synthetic dataset. | High | Medium | Implement cross-validation. Validate model against a hold-out test set (20%). | ML Engineer |
| **R03** | OR-Tools CVRP solver takes too long to compute routes. | Low | High | Set a strict `time_limit_ms` in the routing solver heuristics. | Backend Dev |
| **R04** | Leaflet Map crashes when rendering > 1,000 bins. | Medium | Low | Implement marker clustering using `react-leaflet-cluster`. | Frontend Dev |
