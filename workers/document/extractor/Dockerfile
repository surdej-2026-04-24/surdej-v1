FROM python:3.12-slim

WORKDIR /app

COPY workers/document/extractor/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY workers/document/extractor/*.py .

EXPOSE 8091

CMD ["python", "main.py"]
