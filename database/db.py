import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from dotenv import load_dotenv
from database.models import Base

# Load environment variables
load_dotenv()

# Database URL configuration (defaults to SQLite for local development convenience)
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./waste_management.db")

# Create engine
# If SQLite, allow multi-threaded access for FastAPI
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL, pool_size=10, max_overflow=20)

# Create session factories
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db_session = scoped_session(SessionLocal)

def init_db():
    """Initializes the database by creating all tables if they don't exist."""
    print(f"Initializing database: {DATABASE_URL}")
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized successfully.")

def get_db():
    """Dependency for FastAPI endpoints to yield a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
