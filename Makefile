# ─────────────────────────────────────────────
# Code Quality / Formatting Targets
# ─────────────────────────────────────────────

.PHONY: fmt lint typecheck security audit all

# Format using Black + Ruff (auto-fix)
fmt:
	black backend/
	ruff check backend/ --fix

# Lint using Ruff (no auto-fix)
lint:
	ruff check backend/

# Type checking
typecheck:
	mypy backend/

# Security analysis
security:
	bandit -r backend/

# Dependency vulnerability audit
audit:
	pip-audit -r backend/requirements.txt

# Run everything
all: fmt lint typecheck security audit

