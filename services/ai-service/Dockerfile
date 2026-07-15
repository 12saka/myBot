# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies if required (mostly for pandas/scikit-learn C compilation if wheels aren't used)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container
COPY services/ai-service/requirements.txt ./

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the service source code
COPY services/ai-service/ ./

# Expose port 8000 for FastAPI
EXPOSE 8000

# Define environment variables
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

# Run uvicorn on container startup
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
