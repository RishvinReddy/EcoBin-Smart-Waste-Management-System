# 08 Deployment

## 1. Containerization Strategy

EcoBin uses Docker and Docker Compose to ensure a reproducible environment across development and production. The deployment architecture consists of three core containers:
1. **PostgresDB:** Relational database for production deployment.
2. **Backend API:** Uvicorn ASGI server running the FastAPI application.
3. **Frontend App:** Nginx server serving the built static Vite/React assets.

## 2. Docker Compose Configuration

The `docker-compose.yml` file is configured in the project root.

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: ecobin_user
      POSTGRES_PASSWORD: ecobin_password
      POSTGRES_DB: waste_management
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    depends_on:
      - db
    environment:
      - DATABASE_URL=postgresql://ecobin_user:ecobin_password@db:5432/waste_management

  frontend:
    build: ./frontend
    ports:
      - "5173:80"
    depends_on:
      - backend
```

## 3. Local Deployment Instructions

To deploy the entire stack locally for development or demonstration:

1. **Prerequisites:** Ensure Docker Desktop is installed and running.
2. **Execute Compose:** Run the following command in the terminal from the root directory:
   ```bash
   docker-compose up --build
   ```
3. **Access Services:**
   - Frontend Dashboard: `http://localhost:5173`
   - Backend API Docs: `http://localhost:8000/docs`
   - Postgres DB: `localhost:5432`

## 4. CI/CD Pipeline
Future deployments will utilize GitHub Actions to automatically run `pytest`, build Docker images, and push them to a container registry upon merging to the `main` branch.
