# Technical Report

## System Evaluation & Metrics

Our data pipeline automatically computes a comparison against a **Fixed Schedule** baseline.

| Metric | Fixed Schedule | AI System (Optimized) | Improvement |
| :--- | :--- | :--- | :--- |
| **Distance Traveled** | ~142 km | **~94 km** | 33% reduction |
| **Fuel Consumed** | ~42.8 L | **~28.3 L** | 33% reduction |
| **Overflowing Bins** | ~11 bins | **~2 bins** | 80% prevention rate |
| **Truck Capacity Util.** | ~42% | **~82%** | Optimized loads |

## Optimization Mathematics

The Priority Score dictating routing inclusion is calculated as:
`Priority = (Predicted Fill * 0.6) + (Overflow Prob * 0.2) + (Area Priority * 0.2)`

The Overflow Probability is mapped via a Cumulative Density Function using the model's Root Mean Squared Error (RMSE):
`P(Fill >= 80%) = 1 - Φ((80 - ŷ) / RMSE)`
