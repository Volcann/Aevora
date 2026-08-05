SHELL=/bin/bash

dc := docker compose

success := success

build:
	@$(dc) build

up:
	@$(dc) up

up.d:
	@$(dc) up -d
	@$(MAKE) reboot_tools
	@echo "$(success)"

down:
	@$(dc) down --remove-orphans
	@echo "$(success)"

# ------------------------
# Django one-off commands
# ------------------------
reboot_tools:
	@$(dc) exec django python manage.py reboot_tools

dcshell:
	@$(dc) exec django /bin/bash

makemigrations:
	@$(dc) exec django python manage.py makemigrations

migrate:
	@$(dc) exec django python manage.py migrate

collectstatic:
	@$(dc) exec django python manage.py collectstatic --noinput

showmigrations:
	@$(dc) exec django python manage.py showmigrations $(APP)

createsuperuser:
	@$(dc) exec django python manage.py createsuperuser

createapp:
	@$(dc) exec django python manage.py startapp $(APP)

# ------------------------
# Database & Redis
# ------------------------
psql:
	@$(dc) exec postgres psql -U postgres

# ------------------------
# VS Code Extensions
# ------------------------
vscode-extensions:
	@for ext in charliermarsh.ruff ms-python.python batisteo.vscode-django eamodio.gitlens usernamehw.errorlens ms-azuretools.vscode-docker; do \
		code --install-extension $$ext || true; \
	done

# ------------------------
# Tests
# ------------------------
test:
	@$(dc) up -d django
	@$(dc) exec -T django python manage.py migrate
	@$(dc) exec -T django python manage.py collectstatic --no-input
	@$(dc) exec -T django python -m coverage run --source='.' manage.py test --no-input
	@$(dc) exec -T django python -m coverage html -d htmlcov
	@$(dc) down --remove-orphans

# ------------------------
# Linting & Formatting
# ------------------------
lint:
	@uv run ruff check --fix .
	@uv run ruff format .

ci:
	@echo "Running CI checks locally..."
	@echo "Checking code style (ruff)..."
	@uv run ruff check .
	@echo "Checking formatting (ruff format)..."
	@uv run ruff format --check .
	@echo "Running tests..."
	@$(MAKE) test

clean:
	rm -rf build dist *.egg-info .pytest_cache .mypy_cache .ruff_cache .coverage htmlcov
	find . -type d -name __pycache__ -exec rm -rf {} +
