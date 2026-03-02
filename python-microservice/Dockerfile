FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && \
    apt-get install -y ffmpeg && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_RUN=1
ENV PORT=8000

EXPOSE 8000

CMD ["python", "video_processor.py"]

