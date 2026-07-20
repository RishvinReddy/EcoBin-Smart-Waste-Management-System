# Project Plan

## 1. Execution Strategy

```mermaid
gantt
    title EcoBin Master Plan
    dateFormat  YYYY-MM-DD
    section Phase 1
    System Design & Architecture :done, p1, 2026-06-01, 7d
    section Phase 2
    Hardware Simulation (Wokwi)  :active, p2, 2026-06-08, 14d
    section Phase 3
    Machine Learning & Routing   :p3, 2026-06-22, 14d
    section Phase 4
    Dashboard & Final Deployment :p4, 2026-07-06, 14d
```

## 2. Resource Allocation

| Resource Type | Specification | Assignment / Owner |
| :--- | :--- | :--- |
| **Infrastructure** | Docker Desktop, PostgreSQL, GitHub Actions | DevOps Engineer |
| **Hardware** | ESP32, HC-SR04, PIR (Simulated on Wokwi) | IoT Hardware Lead |
| **Software Tools** | Python 3.10, FastAPI, React 18 | Fullstack Developer |
| **ML Frameworks** | XGBoost, Scikit-Learn, OR-Tools | Machine Learning Engineer |
