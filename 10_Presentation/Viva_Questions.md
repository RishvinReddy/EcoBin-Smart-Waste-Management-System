# Viva / Interview Questions

**Q1: Why use XGBoost instead of a simpler model like Linear Regression?**
*A:* Waste accumulation is non-linear and heavily influenced by categorical variables like "Day of the Week" or "Holiday". XGBoost (gradient boosted trees) handles these complex, non-linear relationships much better than linear regression.

**Q2: What is the Capacitated Vehicle Routing Problem (CVRP)?**
*A:* It is a variant of the Traveling Salesperson Problem where we must find the optimal route to visit a set of nodes, but we are constrained by the physical capacity of the vehicle. The truck cannot collect more waste than it can carry.

**Q3: How does the system handle a sensor failure?**
*A:* If the backend hasn't received a heartbeat POST from a bin in 2 hours, it marks the bin as "Offline". The ML model can fall back to imputing the missing data based on historical averages until maintenance repairs the sensor.

**Q4: Why simulate the hardware in Wokwi instead of using real ESP32s initially?**
*A:* Wokwi allows for rapid software iteration and testing of edge cases (like faking sensor errors) without the overhead of physical wiring, power management, and hardware debugging.
