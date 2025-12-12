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
audit:
	pip-audit -r requirements.txt

# Run everything
all: fmt lint typecheck security audit

