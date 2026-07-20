# Literature Review

## 1. IoT in Waste Management
Recent studies demonstrate that Ultrasonic sensors (HC-SR04) provide highly reliable readings for solid waste, provided the beam angle (usually 15 degrees) clears the bin walls. Power consumption remains the largest hurdle, which is mitigated by employing deep-sleep modes on the ESP32.

## 2. Machine Learning Forecasting
A 2021 study on municipal waste generation highlighted that waste accumulation is heavily correlated with calendar features (Day of week, holidays) and spatial features (population density, commercial presence). While ARIMA models were historically used, gradient boosting frameworks (XGBoost) consistently exhibit lower RMSE when handling non-linear human behavior patterns.

## 3. Vehicle Routing Problem (VRP)
The CVRP (Capacitated VRP) is NP-hard. Exact solvers fail to compute routes for >50 nodes within reasonable timeframes. Meta-heuristic solvers, specifically Google's OR-Tools, have emerged as the industry standard, providing near-optimal solutions for hundreds of nodes in under a minute using Guided Local Search.
