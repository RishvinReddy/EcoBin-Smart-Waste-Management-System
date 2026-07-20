# Test Plan

## Scope of Testing
The EcoBin testing suite encompasses:
1. **Unit Testing:** Individual Python functions in the `ml/` and `backend/` directories.
2. **Integration Testing:** Ensuring the Wokwi edge nodes communicate smoothly with the API, and the API correctly queries the OR-Tools C++ bindings.
3. **UI/UX Testing:** Validating React component states and Leaflet map rendering.

## Testing Tools
- **Backend:** `pytest`, `pytest-asyncio`
- **Frontend:** `Jest`, `React Testing Library`
- **Load Testing:** `Locust`
- **Hardware:** Manual slider manipulation inside the Wokwi simulator GUI.
