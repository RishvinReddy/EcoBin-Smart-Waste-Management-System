# 00 Project Management

## 1. Project Charter

**Project Name:** EcoBin: Smart Waste Fill-Level Prediction & Route Optimization  
**Description:** EcoBin is an AI-powered municipal waste management system that simulates IoT bin sensors, predicts waste levels, identifies overflow risks, and solves vehicle routing using Google OR-Tools.

### Objectives
- **Operational Efficiency:** Reduce distance traveled and fuel consumed by municipal waste trucks by at least 30%.
- **Predictive Maintenance:** Utilize XGBoost machine learning to predict bin overflow 24 hours in advance with a high degree of accuracy (80%+ prevention rate).
- **Scalability:** System built using a robust backend (FastAPI), modern frontend (React/TypeScript), and SQL Database to easily handle thousands of simulated IoT endpoints.

## 2. Project Timeline (Milestones)

| Phase | Description | Deliverables |
| :--- | :--- | :--- |
| **Phase 1: Research & Design** | System architecture and ML model selection | ER Diagrams, API Contracts, Tech Stack Finalized |
| **Phase 2: Backend & Database** | Build FastAPI server and Postgres/SQLite schema | Database schemas, REST API endpoints, Auth |
| **Phase 3: Hardware Simulation** | Simulate ESP32, Ultrasonic, PIR in Wokwi | `diagram.json`, `wokwi.toml`, `hardware` folder |
| **Phase 4: ML & Optimization** | XGBoost integration and OR-Tools CVRP | Forecasting script, route optimization engine |
| **Phase 5: Frontend Dashboard** | React Leaflet UI, Dark theme, Responsive | `frontend` folder, API integration |
| **Phase 6: Testing & Deployment** | End-to-end testing, Dockerization | `docker-compose.yml`, Unit tests |

## 3. Team Roles and Responsibilities

- **Project Manager:** Coordinates sprint cycles, manages timelines, and handles overall delivery.
- **Backend Engineer:** Designs FastAPI endpoints and SQLAlchemy data models.
- **Machine Learning Engineer:** Focuses on the XGBoost prediction models and synthetic data generator.
- **Operations Research Engineer:** Solves the CVRP problem using Google OR-Tools.
- **Frontend Developer:** Builds the React + TypeScript Leaflet map dashboard.
- **IoT / Hardware Engineer:** Configures the ESP32 Wokwi simulations.

## 4. Risk Management

| Risk | Impact | Probability | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Hardware Failure Simulation** | High | Medium | Implement robust fallback API responses. Use synthetic data for continuous testing. |
| **ML Model Overfitting** | High | Low | Validate model against baseline. Use K-Fold Cross Validation. |
| **Route Optimization Timeouts** | Medium | Medium | Cap CVRP solver execution time using OR-Tools time limits. |
