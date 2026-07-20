# Non-Functional Requirements

1. **Performance:**
   - The ML forecasting pipeline must train on 1 year of historical data (~4.38M records) in under 3 minutes.
   - OR-Tools must return a valid CVRP solution within a maximum of 30 seconds.
   - API response time for `GET /api/bins` must remain under 200ms.

2. **Scalability:**
   - The backend architecture (FastAPI + Uvicorn) must support asynchronous concurrent connections to handle thousands of simultaneous IoT payloads.
   - The React-Leaflet map must smoothly render up to 5,000 bin markers without browser lag (using marker clustering).

3. **Security:**
   - All IoT hardware communication must be authenticated using an API Token in the HTTP headers.
   - Dashboard access requires JWT-based authentication.
   - The PostgreSQL database must not be exposed to the public internet.

4. **Usability:**
   - The dashboard must feature a dark theme (glassmorphism) optimized for municipal control room displays.
   - Multi-language support must be implemented using `react-i18next` (e.g., English, Telugu, Hindi).
