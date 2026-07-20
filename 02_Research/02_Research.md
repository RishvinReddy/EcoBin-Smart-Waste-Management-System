# 02 Research

## 1. Literature Review

Municipal Solid Waste Management (MSWM) is a critical component of modern smart cities. Traditional waste collection relies on static, fixed-route schedules where trucks visit every bin in a zone regardless of its fill level. This approach results in significant inefficiencies, increased carbon emissions, and frequent occurrences of overflowing bins.

Recent advancements in IoT and Machine Learning have paved the way for dynamic, data-driven waste management. By attaching ultrasonic sensors to waste bins, municipalities can monitor real-time fill levels. 

### Key Findings:
- **IoT Sensors:** The HC-SR04 ultrasonic sensor paired with ESP32 microcontrollers offers a low-cost, low-power solution for continuous monitoring.
- **Machine Learning:** Time-series forecasting using XGBoost and Ridge Regression outperforms traditional statistical models in predicting non-linear waste accumulation rates influenced by holidays, weekends, and area demographics.
- **Operations Research:** The Capacitated Vehicle Routing Problem (CVRP) is effectively solved using heuristic solvers like Google OR-Tools, which can handle hundreds of nodes (bins) within acceptable time limits.

## 2. Technology Stack Selection

After evaluating various modern frameworks, the following stack was chosen to maximize performance, scalability, and ease of development:

### Backend Architecture
- **Language:** Python 3
- **Web Framework:** FastAPI (Chosen for its asynchronous capabilities and auto-generated Swagger documentation).
- **Database:** PostgreSQL (Production) / SQLite (Development).
- **ORM:** SQLAlchemy.

### Machine Learning & Optimization
- **Data Manipulation:** Pandas and NumPy.
- **Forecasting Models:** XGBoost and Scikit-Learn (Ridge). Chosen due to XGBoost's superior handling of structured tabular data.
- **Optimization Engine:** Google OR-Tools. Provides robust, highly optimized C++ binaries via Python bindings for solving complex routing problems.

### Frontend Dashboard
- **Framework:** React.js with TypeScript.
- **Build Tool:** Vite (Chosen for fast HMR and optimized builds).
- **Mapping:** React-Leaflet. Chosen for its lightweight footprint compared to Google Maps, making it ideal for rendering hundreds of markers efficiently.
- **Styling:** Vanilla CSS with custom CSS Variables for a dynamic, glassmorphic dark theme.

### Hardware Simulation
- **Platform:** Wokwi. Chosen because it provides a reliable, browser-based hardware simulator for ESP32 without requiring physical hardware prototyping during the initial software development phases.
