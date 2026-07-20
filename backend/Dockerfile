FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (build-essential needed for any C compilations like greenlet, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

EXPOSE 8000

# Command to run database initialization, pipeline generation, and start FastAPI server
CMD python -m database.db && python run_pipeline.py && python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000
