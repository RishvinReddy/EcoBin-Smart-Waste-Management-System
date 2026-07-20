# Test Cases

| TC ID | Test Scenario | Steps to Execute | Expected Result |
| :--- | :--- | :--- | :--- |
| **TC-01** | API Endpoint /bins | Send GET req to `/api/bins` | Returns 200 OK with JSON array of bins. |
| **TC-02** | Invalid Payload POST | Send POST without `fill` key | Returns 422 Unprocessable Entity. |
| **TC-03** | Overflow Logic | Pass bin with 90% fill to `features.py` | Priority score calculates > 0.70. |
| **TC-04** | Route Capacity Limit | Route sum total > Truck Capacity | Solver splits route or leaves low-priority bins. |
| **TC-05** | Dashboard Rendering | Open `localhost:5173` | Map initializes at default coordinates without crashing. |
