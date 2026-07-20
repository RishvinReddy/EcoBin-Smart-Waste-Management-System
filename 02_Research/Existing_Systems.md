# Existing Systems

## 1. Traditional System Workflow

```mermaid
flowchart LR
    A[Fixed Schedule] --> B[Truck Leaves Depot]
    B --> C[Visits Bin 1 (Empty)]
    C --> D[Visits Bin 2 (Empty)]
    D --> E[Visits Bin 3 (Overflowing)]
    E --> F[Return to Depot]
    
    style C fill:#f99,stroke:#333
    style D fill:#f99,stroke:#333
```

## 2. Comparison Table

| System Type | Approach | Major Flaw | EcoBin Improvement |
| :--- | :--- | :--- | :--- |
| **Static Routing** | Fixed daily schedules. | High fuel waste visiting empty bins. | Dynamic routing skips empty bins. |
| **Reactive Telemetry** | Sensors alert *after* bin is full. | Causes mid-day route scrambling. | Predicts fullness 24h in advance. |
| **Enterprise Bins** | Expensive solar compactors. | Cost prohibitive for city-wide rollout. | Retrofits existing bins with cheap ESP32s. |
