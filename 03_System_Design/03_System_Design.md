# 03 System Design

## 1. System Architecture

The EcoBin system employs a decoupled, microservice-inspired architecture.

```mermaid
graph TD
    subgraph IoT Edge
        HW[Wokwi ESP32 Simulation] -->|HTTP POST| API[FastAPI Gateway]
    end

    subgraph Backend Core
        API --> DB[(PostgreSQL / SQLite)]
        API --> Routing[OR-Tools CVRP Solver]
    end

    subgraph ML Pipeline
        Sync[Synthetic Data Generator] --> DB
        DB --> FE[Feature Engineering]
        FE --> Model[XGBoost Forecaster]
        Model --> Routing
    end

    subgraph Presentation
        Dashboard[React Leaflet Dashboard] -->|HTTP GET / JSON| API
    end
```

## 2. Database Schema Design (Entity Relationship)

```mermaid
erDiagram
    BIN {
        string bin_id PK
        float latitude
        float longitude
        float capacity
        float current_fill_percentage
        string status
    }
    FILL_HISTORY {
        int history_id PK
        string bin_id FK
        datetime timestamp
        float fill_percentage
    }
    PREDICTION {
        int prediction_id PK
        string bin_id FK
        float predicted_fill
        float overflow_probability
    }
    TRUCK {
        string truck_id PK
        float capacity
        string status
        string driver_id FK
    }
    OPTIMIZED_ROUTE {
        int route_id PK
        string truck_id FK
        date date
        string route_path
    }
    
    BIN ||--o{ FILL_HISTORY : "logs"
    BIN ||--o{ PREDICTION : "forecasts"
    TRUCK ||--o{ OPTIMIZED_ROUTE : "executes"
```

## 3. API Contract Highlights

- `GET /api/bins` - Retrieves all bins with real-time status and coordinates.
- `GET /api/routes/latest` - Fetches the most recently computed CVRP route paths.
- `GET /api/analytics` - Returns system evaluation metrics (AI vs Fixed Schedule).
- `POST /api/iot/push` - Endpoint for the ESP32 hardware to push new sensor readings.
