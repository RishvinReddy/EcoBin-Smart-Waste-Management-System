# Project Report

## 1. Phased Execution

```mermaid
gantt
    title Project Phases
    dateFormat YYYY-MM-DD
    section Phase 1: Hardware
    Wokwi Simulation :done, 2026-06-01, 7d
    section Phase 2: Data
    Synthetic Pipeline :done, 2026-06-08, 7d
    section Phase 3: AI
    XGBoost & Routing :done, 2026-06-15, 14d
    section Phase 4: UI
    React Dashboard :done, 2026-06-29, 7d
```

## 2. Phase Summaries

| Phase | Focus Area | Technologies | Deliverable |
| :--- | :--- | :--- | :--- |
| **1** | Hardware & IoT | ESP32, C++, Wokwi | Simulated nodes pushing JSON. |
| **2** | Data Pipeline | FastAPI, PostgreSQL | 4.38M synthetic records ingested. |
| **3** | Intelligence | XGBoost, OR-Tools | AI models forecasting and routing. |
| **4** | Visualization | React, Leaflet | Interactive municipal dashboard. |
