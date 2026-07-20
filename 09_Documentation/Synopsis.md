# Synopsis

**Project Title:** EcoBin Smart Waste Fill-Level Prediction & Route Optimization

**Problem:** Cities spend millions on fuel and labor sending waste trucks to empty bins, while bins in busy areas overflow because they aren't scheduled for pickup until the next day.

**Solution:** EcoBin introduces a dual-layered AI approach. 
1. We use an ESP32 simulator to generate sensor data.
2. We train an XGBoost model to predict *when* a bin will become full based on historical trends.
3. We feed the high-risk bins into Google OR-Tools to generate an optimal driving path.

**Impact:** Demonstrates a 33% reduction in distance traveled while drastically improving urban sanitation.
