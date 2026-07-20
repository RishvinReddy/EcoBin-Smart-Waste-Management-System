# Maintenance Guide

## 1. Maintenance Workflow

```mermaid
flowchart LR
    A[Maintenance Alert] --> B{Type of Error?}
    B -- Backend Hang --> C[Restart Docker Container]
    B -- Node Offline --> D[Check Wokwi Gateway]
    B -- DB Bloat --> E[Run Archival Script]
    
    C --> F((Resolved))
    D --> F
    E --> F
```

## 2. Troubleshooting Matrix

| Issue | Symptom | Resolution / Command |
| :--- | :--- | :--- |
| **API Hangs** | 502 Bad Gateway / Timeout | `docker-compose restart backend` |
| **Node Offline** | Wokwi slider moves, no data | Restart Wokwi Local Gateway. |
| **DB Bloat** | Storage 95% full | `python migrate_maintenance.py` (Archives to CSV) |
| **Map Blank** | CORS error in browser console | Check `ALLOW_ORIGINS` in `.env`. |
