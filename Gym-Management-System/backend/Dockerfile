# Use Python 3.11 slim image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements first (for better caching)
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire backend folder
COPY . .

# Expose port 8000
EXPOSE 8000

# Command to run the application - main.py is inside app folder
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
