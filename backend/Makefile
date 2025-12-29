# ─────────────────────────────────────────────
# Code Quality / Formatting Targets
# ─────────────────────────────────────────────

.PHONY: fmt lint typecheck security audit all

# Format using Black + Ruff (auto-fix)
fmt:
	black .
	ruff check . --fix

# Lint using Ruff (no auto-fix)
lint:
	ruff check .

# Type checking
typecheck:
	mypy .

# Security analysis
security:
	bandit -r .

# Dependency vulnerability audit
# Uses UV if available, falls back to pip-audit
audit:
	@if command -v uv >/dev/null 2>&1; then \
		echo "Using UV for audit..."; \
		uv pip audit -r requirements.txt; \
	else \
		echo "Using pip-audit..."; \
		pip-audit -r requirements.txt; \
	fi

# Run everything
all: fmt lint typecheck security audit

# ─────────────────────────────────────────────
# Development Helpers
# ─────────────────────────────────────────────

.PHONY: install-deps shell runserver migrate

# Install/update dependencies using UV
install-deps:
	@echo "Installing dependencies with UV..."
	uv pip install -r requirements.txt

# Run Django shell using UV (no venv activation needed)
shell:
	uv run python manage.py shell

# Run Django development server using UV
runserver:
	uv run python manage.py runserver

# Run Django migrations using UV
migrate:
	uv run python manage.py migrate

