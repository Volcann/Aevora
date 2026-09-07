import os

# Flower configuration
# Note: broker URL is automatically taken from Celery app when using 'celery -A <app> flower'
# Only Flower-specific settings should be here

url_prefix = "flower"
port = 5555

# Optional: Basic auth if credentials are provided
flower_username = os.getenv("FLOWER_USERNAME", None)
flower_password = os.getenv("FLOWER_PASSWORD", None)

if flower_username and flower_password:
    basic_auth = [f"{flower_username}:{flower_password}"]
else:
    basic_auth = None
