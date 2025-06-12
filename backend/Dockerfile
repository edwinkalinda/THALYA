FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Environment variables
ENV PORT=8000
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

# Expose the port
EXPOSE 8000

# Run the application
CMD ["python", "app.py"]  # Ensure app.py exists or make this configurable
