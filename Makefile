# ─────────────────────────────────────────────
# Code Quality / Formatting Targets
# ─────────────────────────────────────────────

# Get the directory where this Makefile is located
ROOT_DIR := $(shell dirname $(realpath $(lastword $(MAKEFILE_LIST))))

# Virtual environment paths
VENV_BIN := $(ROOT_DIR)/backend/venv/bin
PYTHON := $(VENV_BIN)/python
BLACK := $(VENV_BIN)/black
RUFF := $(VENV_BIN)/ruff
MYPY := $(VENV_BIN)/mypy
BANDIT := $(VENV_BIN)/bandit
PIP_AUDIT := $(VENV_BIN)/pip-audit

# Directory paths
BACKEND_DIR := $(ROOT_DIR)/backend
FRONTEND_DIR := $(ROOT_DIR)/frontend

.PHONY: fmt lint typecheck security audit all frontend-fmt frontend-lint

# Format: Backend (Black + Ruff) + Frontend (ESLint auto-fix)
fmt:
	@echo "=== Running Frontend Formatting (ESLint auto-fix) ==="
	@cd $(FRONTEND_DIR) && npm run lint:fix || echo "Frontend formatting completed with errors"
	@echo ""
	@echo "=== Running Backend Formatting ==="
	@echo "Running Black..."
	@$(BLACK) $(BACKEND_DIR)
	@echo "Running Ruff (auto-fix)..."
	@$(RUFF) check $(BACKEND_DIR) --fix
	@echo ""
	@echo "Formatting completed!"

# Backend: Lint using Ruff (no auto-fix)
lint:
	@echo "Running Ruff linter..."
	@$(RUFF) check $(BACKEND_DIR)

# Backend: Type checking
typecheck:
	@echo "Running MyPy type checker..."
	@$(MYPY) $(BACKEND_DIR)

# Backend: Security analysis
security:
	@echo "Running Bandit security scanner..."
	@$(BANDIT) -r $(BACKEND_DIR)

# Backend: Dependency vulnerability audit
# Uses UV if available, falls back to pip-audit
audit:
	@echo "Running dependency audit..."
	@if command -v uv >/dev/null 2>&1; then \
		echo "Using UV for audit..."; \
		uv pip audit -r $(BACKEND_DIR)/requirements.txt; \
	else \
		echo "Using pip-audit..."; \
		$(PIP_AUDIT) -r $(BACKEND_DIR)/requirements.txt; \
	fi

# Frontend: Format/Lint fix (auto-fix ESLint errors)
frontend-fmt:
	@echo "Running ESLint (auto-fix)..."
	@cd $(FRONTEND_DIR) && npm run lint:fix

# Frontend: Lint check (no auto-fix)
frontend-lint:
	@echo "Running ESLint..."
	@cd $(FRONTEND_DIR) && npm run lint

# Run everything
all: fmt lint typecheck security audit frontend-fmt frontend-lint
	@echo "All checks completed!"
