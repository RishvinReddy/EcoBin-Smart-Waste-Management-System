# 01 Requirements

## 1. Functional Requirements

### 1.1 Hardware and IoT Simulation
- **FR1.1:** The system must simulate an ESP32 microcontroller reading distance values from an HC-SR04 ultrasonic sensor.
- **FR1.2:** The system must trigger an alert using a PIR motion sensor when tampering or unverified access is detected.
- **FR1.3:** The hardware must display basic status on an I2C LCD1602 screen and indicate alerts via an RGB LED and Buzzer.
- **FR1.4:** Simulated IoT devices must push fill-level data (0-100%), battery status, and signal strength to the backend API.

### 1.2 Backend and Database
- **FR2.1:** The backend must provide a RESTful API using FastAPI for data ingestion and client consumption.
- **FR2.2:** The database must store historical fill logs, bin metadata (GPS, capacity), and generated routes.
- **FR2.3:** The system must automatically generate synthetic hourly activity records for training if real data is unavailable.
- **FR2.4:** The system must calculate an optimized routing path daily using the Capacitated Vehicle Routing Problem (CVRP) model.

### 1.3 Machine Learning
- **FR3.1:** The system must forecast the fill-level for the next 24 hours for every active bin.
- **FR3.2:** The model must output an overflow probability by mapping predictions against standard error (RMSE).
- **FR3.3:** The priority engine must assign a priority score to each bin based on its predicted fill, overflow probability, and area type.

### 1.4 Frontend Dashboard
- **FR4.1:** The UI must display all bins on an interactive map (Leaflet) with color-coded markers indicating fill status.
- **FR4.2:** The dashboard must show real-time metrics comparing the AI-optimized system to a Fixed Schedule baseline.
- **FR4.3:** The UI must display the optimized path drawn between bins for a given truck.

## 2. Non-Functional Requirements

### 2.1 Performance
- **NFR1.1:** API endpoints should respond within 200ms under normal load.
- **NFR1.2:** The ML forecasting and route optimization pipeline for 500 bins must complete in under 5 minutes on a standard CPU.

### 2.2 Scalability
- **NFR2.1:** The backend should support scaling up to thousands of concurrent simulated IoT endpoints using asynchronous connections.
- **NFR2.2:** The database should efficiently handle time-series data indexing for the fill history table (approx. 4.38M records per simulated year).

### 2.3 Usability
- **NFR3.1:** The frontend must implement a responsive, modern dark-themed UI (glassmorphism) suitable for municipal control rooms.
- **NFR3.2:** The system must provide multi-language support (e.g., Telugu, Hindi, English).

### 2.4 Reliability & Security
- **NFR4.1:** The system must containerize using Docker to ensure consistency across development and production environments.
- **NFR4.2:** System interactions must be secured using JWT authentication for dashboard access and API tokens for IoT ingestion.
