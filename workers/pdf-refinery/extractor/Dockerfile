FROM python:3.12-slim

WORKDIR /app

# Install system deps for pymupdf
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY workers/pdf-refinery/extractor/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY workers/pdf-refinery/extractor/main.py .

EXPOSE 8090

CMD ["python", "main.py"]
