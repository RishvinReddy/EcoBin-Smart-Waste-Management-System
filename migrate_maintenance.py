import sys
sys.path.insert(0, '.')
from database.db import engine
from database.models import Base, MaintenanceWorker, MaintenanceLog
from sqlalchemy import inspect
from sqlalchemy.orm import sessionmaker
import datetime

inspector = inspect(engine)
tables = inspector.get_table_names()
print("Tables before:", tables)

Base.metadata.create_all(bind=engine)
print("Tables after:", inspect(engine).get_table_names())

Session = sessionmaker(bind=engine)
db = Session()

TEAM = [
    {"worker_id": "MNT001", "name": "Arun Sharma",  "phone": "+91 99001 11001", "zone": "Banjara Hills / Jubilee Hills"},
    {"worker_id": "MNT002", "name": "Sujatha Devi", "phone": "+91 99001 11002", "zone": "Begumpet / Secunderabad"},
    {"worker_id": "MNT003", "name": "Ravi Kiran",   "phone": "+91 99001 11003", "zone": "Kukatpally / KPHB"},
    {"worker_id": "MNT004", "name": "Priya Nair",   "phone": "+91 99001 11004", "zone": "LB Nagar / Dilsukhnagar"},
]

for w in TEAM:
    existing = db.query(MaintenanceWorker).filter(MaintenanceWorker.worker_id == w["worker_id"]).first()
    if not existing:
        db.add(MaintenanceWorker(**w))
        print("  Seeded:", w["worker_id"], "-", w["name"])
    else:
        print("  Already exists:", w["worker_id"])

db.commit()

count = db.query(MaintenanceWorker).count()
print("Total maintenance workers in DB:", count)
db.close()
print("Migration complete.")
