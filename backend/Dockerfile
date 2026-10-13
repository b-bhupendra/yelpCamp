# Production Dockerfile for YelpCamp FastAPI Backend on Google Cloud Run
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Expose port
EXPOSE 8080

# Start Uvicorn bound to Cloud Run PORT
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT}

