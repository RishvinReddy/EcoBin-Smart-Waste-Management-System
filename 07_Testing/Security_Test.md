# Security Test

## Threat Modeling & Mitigation

1. **IoT Endpoint Spoofing:**
   - *Threat:* Malicious actors POSTing fake bin data to skew routing.
   - *Test:* Attempted `POST /api/iot/push` without the `x-api-key` header.
   - *Result:* **PASS** (401 Unauthorized returned).

2. **Dashboard Unauthorized Access:**
   - *Threat:* Unauthenticated users viewing routing logic.
   - *Test:* Navigating to `http://localhost:5173/dashboard` without a valid JWT token in LocalStorage.
   - *Result:* **PASS** (Redirected to `/login`).

3. **SQL Injection:**
   - *Threat:* Injecting SQL via the `bin_id` parameter.
   - *Test:* `GET /api/bins/?bin_id=' OR 1=1;--`
   - *Result:* **PASS** (SQLAlchemy ORM automatically sanitizes parameters).
