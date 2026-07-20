# User Manual

## 1. Dashboard User Journey

```mermaid
journey
    title Municipal Operator Daily Workflow
    section Login
      Enter Credentials: 5: Operator
      Authenticate JWT: 5: System
    section Monitoring
      View Map: 4: Operator
      Identify Red Bins: 5: Operator
    section Action
      Click Generate Route: 5: Operator
      Calculate CVRP: 4: AI Model
      Dispatch Truck: 5: Operator
```

## 2. UI Legend

| UI Element | Color / Icon | Meaning | Action Required |
| :--- | :--- | :--- | :--- |
| **Marker** | 🟢 Green | Bin is under 50% capacity. | None. |
| **Marker** | 🔴 Red | Bin > 80% OR predicted to overflow. | Needs routing. |
| **Polyline**| 🔵 Blue Line| The optimized CVRP driving path. | Provide to drivers. |
| **KPI Box** | ⚪ White Panel| Displays "Distance Saved" vs baseline. | Use for weekly reports. |
