<div align="center">
  <h1>♻️ EcoBin</h1>
  <p><strong>Smart Waste Fill-Level Prediction & Route Optimization System</strong></p>
  
  [![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/downloads/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.103.1-009688.svg?style=flat&logo=FastAPI&logoColor=white)](https://fastapi.tiangolo.com)
  [![React](https://img.shields.io/badge/React-18.2.0-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791.svg?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Docker](https://img.shields.io/badge/Docker-Supported-2496ED.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
</div>

<br />

EcoBin is an AI-powered municipal waste management system that simulates IoT bin sensors, predicts tomorrow's waste levels, identifies overflow risks, and solves vehicle routing using Google OR-Tools. It provides a comprehensive, interactive dark-themed dashboard to visualize coordinates, active paths, and comparison metrics.

---

## ✨ Key Features

- 🧠 **AI-Powered Predictions**: Uses XGBoost and Ridge Regression to forecast bin fill levels with high accuracy.
- 🚚 **Dynamic Route Optimization**: Utilizes Google OR-Tools to solve the Capacitated Vehicle Routing Problem (CVRP), minimizing travel distance and fuel consumption.
- 📊 **Real-time Analytics Dashboard**: A glassmorphic, dark-themed React + Leaflet dashboard for monitoring bin status and routes.
- 🏭 **Synthetic Data Generation**: Built-in simulator for generating robust, realistic IoT sensor data (4.38M+ records for 500 bins).
- 🐳 **Dockerized Deployment**: Fully containerized for easy setup and teardown.

---

## 🏗️ Architecture Overview

```mermaid
graph TD
    A[Synthetic Data Generator] -->|4.38M records| B[(PostgreSQL / SQLite Database)]
    B --> C[Feature Engineering Module]
    C --> D[ML Forecasting Models XGBoost/Ridge]
    D -->|Forecast & Overflow Probabilities| E[Priority Engine]
    E -->|Scheduled Bins list| F[VRP Routing Solver OR-Tools]
    F -->|Optimized Route Paths| G[FastAPI Backend APIs]
    G -->|JSON Payload| H[React Leaflet Dashboard]
```

---

## 🛠️ Technology Stack

### Backend & Machine Learning
- **Python 3.9+**
- **FastAPI**: High-performance REST API framework.
- **SQLAlchemy**: ORM for database interactions.
- **XGBoost & scikit-learn**: For predictive modeling and forecasting.
- **Google OR-Tools**: For complex route optimization (VRP).

### Frontend
- **React 18** (with TypeScript)
- **Vite**: Next-generation frontend tooling.
- **Leaflet & React-Leaflet**: For interactive map visualizations.

### Infrastructure
- **PostgreSQL / SQLite**
- **Docker & Docker Compose**

---

## 📂 Project Structure

```text
smart-waste-management/
│
├── backend/                  # FastAPI web server
├── database/                 # Database schema and connections
├── ml/                       # Machine Learning Pipeline (Data Gen, Feature Eng, Models)
├── optimization/             # Operations Research (OR-Tools VRP Solver)
├── frontend/                 # React + TypeScript + Leaflet app
├── hardware/                 # Hardware simulation & configurations
├── docs/                     # Documentation and guides
├── run_pipeline.py           # Orchestrates end-to-end local run
├── requirements.txt          # Python dependencies
└── docker-compose.yml        # Docker orchestrator
```

---

## 🚀 Getting Started (Local Development)

Follow these steps to set up the project locally for development and testing.

### 1. Backend Setup

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone https://github.com/RishvinReddy/EcoBin-Smart-Waste-Management-System.git
   cd EcoBin-Smart-Waste-Management-System
   ```

2. **Create and Activate a Virtual Environment:**
   ```bash
   python -m venv .venv
   
   # Windows:
   .venv\Scripts\activate
   
   # macOS/Linux:
   source .venv/bin/activate
   ```

3. **Install Dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the Initialization and Data Pipeline:**
   This command creates the database schema, generates 365 days of hourly records (~4.38M records), trains ML models, runs predictive forecasting for tomorrow, and computes optimized routes.
   ```bash
   python run_pipeline.py
   ```

5. **Start the FastAPI Server:**
   ```bash
   python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
   ```
   > 💡 **Tip:** The backend API will be available at `http://127.0.0.1:8000`. You can access the interactive Swagger documentation at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install Node modules:**
   ```bash
   npm install
   ```

3. **Start the Vite development server:**
   ```bash
   npm run dev
   ```
   > 💡 **Tip:** Open `http://localhost:5173` in your browser. The frontend is pre-configured to proxy API requests to `http://127.0.0.1:8000`.

---

## 🐳 Containerized Deployment (Docker)

For a production-like environment, you can spin up PostgreSQL, the FastAPI backend, and the React frontend in containers with a single command:

```bash
docker-compose up --build -d
```

- **Frontend Dashboard**: `http://localhost:5173`
- **FastAPI API**: `http://localhost:8000`
- **PostgreSQL**: Local port `5432`

---

## 📈 System Evaluation Comparison

Our pipeline automatically computes a comparison against a **Fixed Schedule** baseline (where a rigid 1/3 rotation of bins are collected daily).

| Metric | Fixed Schedule | AI System (Optimized) | Improvement |
| :--- | :--- | :--- | :--- |
| **Distance Traveled** | ~142 km | **~94 km** | 🟩 **33% reduction** |
| **Fuel Consumed** | ~42.8 L | **~28.3 L** | 🟩 **33% reduction** |
| **Overflowing Bins** | ~11 bins | **~2 bins** | 🟩 **80% prevention** |
| **Truck Capacity Util.** | ~42% | **~82%** | 🟩 **+40% efficiency** |

### 🔬 Optimization Logic
1. **Machine Learning Model**: XGBoost predicts tomorrow's fill level. An overflow probability is computed by mapping the predictions against the model's standard error (RMSE) using the normal distribution's cumulative density function:
   $$ P(\text{Fill} \ge 80\%) = 1 - \Phi\left(\frac{80 - \hat{y}}{\text{RMSE}}\right) $$
2. **Priority Score**: A combined score is calculated:
   $$ \text{Priority} = (\text{Predicted Fill} \times 0.6) + (\text{Overflow Prob} \times 0.2) + (\text{Area Priority} \times 0.2) $$
3. **Google OR-Tools**: Solves a Capacitated Vehicle Routing Problem (CVRP) to route trucks only through bins exceeding threshold priority constraints, minimizing distance while keeping total volume under vehicle capacities (5000L).

---

## 🤝 Contributing

Contributions are always welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
<div align="center">
  <i>Developed by <strong>Rishvin Reddy</strong> with ❤️ for a cleaner, greener tomorrow.</i>
</div>
