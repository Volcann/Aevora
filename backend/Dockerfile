# ------------------------------
# Stage 1: Build the application
# ------------------------------
FROM python:3.13-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    UV_HTTP_TIMEOUT=300

WORKDIR /app

RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv (pinned version)
COPY --from=ghcr.io/astral-sh/uv:0.9.24 /uv /uvx /bin/


COPY pyproject.toml uv.lock requirements-voice.txt ./
RUN uv venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Add build arg for dev vs prod
ARG DJANGO_ENV=prod
RUN \
  if [ "$DJANGO_ENV" = "dev" ]; then \
    uv sync --frozen; \
  else \
    uv sync --frozen --no-dev; \
  fi


RUN uv pip install --python /opt/venv/bin/python -r requirements-voice.txt

# ------------------------------
# Stage 2: Run the application
# ------------------------------
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev \
    libgomp1 \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder bin/uv /usr/local/bin/uv
COPY --from=builder bin/uvx /usr/local/bin/uvx

COPY --from=builder /opt/venv /opt/venv

RUN useradd -m django \
    && mkdir -p /app/staticfiles /app/media /app/logs \
    && chown -R django:django /app/staticfiles /app/media /app/logs

COPY --chown=django:django . .
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "config.asgi:application", "--host", "0.0.0.0", "--port", "8000"]
