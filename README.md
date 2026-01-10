# Karst

A web and mobile application for managing a database of boulder problems for local crags.

## Features

- Database of boulder problems with detailed information
- Interactive map showing boulder positions
- Photo galleries for each boulder problem
- User tick tracking (mark problems as completed)
- Personal lists (save problems to custom lists)
- Comment system for each problem
- User authentication and profiles

## Project Structure

```text
karst/
├── backend/          # Django backend API
├── frontend/         # React + Vite frontend
└── mobile/          # React Native mobile app (future)
```

## Tech Stack

### Backend

- Django
- Django REST Framework (for REST API)
- Ariadne (for GraphQL API)
- PostgreSQL (recommended) or SQLite (development)

### Frontend

- React
- Vite
- Apollo Client (for GraphQL)
- Leaflet (for interactive maps)

### Mobile (Future)

- React Native

## Getting Started

### Prerequisites

- Python 3.9+
- [UV](https://github.com/astral-sh/uv) (Python package manager)
- Node.js 18+
- npm

### Backend Setup

Using UV for package management (recommended):

```bash
cd backend
# Install dependencies using UV
uv pip install -r requirements.txt

# Run migrations
uv run python manage.py migrate

# Start the development server
uv run python manage.py runserver
```

Alternatively, you can use the Makefile targets:

```bash
cd backend
make install-deps  # Install dependencies
make migrate       # Run migrations
make runserver     # Start the server
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Development

### Django Shell

The project includes `django-extensions` with `shell_plus` for an enhanced Django shell experience.

**Quick start:**

```bash
cd backend
./scripts/bin/shell.sh
```

Or using UV directly:

```bash
cd backend
uv run python manage.py shell_plus --ipython
```

Or using the Makefile:

```bash
cd backend
make shell
```

**To create a shell alias (add to your `~/.zshrc` or `~/.bashrc`):**

```bash
alias shell='cd /Users/Paysure/GIT/karst/backend && ./scripts/bin/shell.sh'
```

You can also use the provided setup script:

```bash
cd backend
./scripts/bin/setup_alias.sh
```

After adding the alias, reload your shell config:

```bash
source ~/.zshrc  # or source ~/.bashrc
```

Then you can simply run:

```bash
shell
```

The shell will automatically:

- Use UV for package management if available (otherwise falls back to traditional venv)
- Import all your models (Crag, Wall, BoulderProblem, Tick, etc.)
- Use IPython for enhanced features
- Load common Django utilities

### Running the Server

To run the development server with automatic migrations:

```bash
cd backend
./scripts/bin/run_server.sh
```

Or using UV directly:

```bash
cd backend
uv run python manage.py runserver
```

Or using the Makefile:

```bash
cd backend
make runserver
```

## Testing

The project uses pytest for backend testing. To run tests:

```bash
cd backend
# Using UV
uv run pytest

# Or with coverage report
uv run pytest --cov-report=term --cov-report=html
```

The project also includes integration tests and uses pytest-django for Django-specific test utilities.

## Code Quality

The project includes automated code quality checks. From the root directory, you can run:

```bash
# Format code (Black + Ruff for backend, ESLint for frontend)
make fmt

# Lint code (no auto-fix)
make lint

# Type checking (MyPy for backend)
make typecheck

# Security analysis (Bandit)
make security

# Dependency vulnerability audit (UV pip audit or pip-audit)
make audit

# Run all checks
make all
```

Frontend-specific commands:

```bash
make frontend-fmt   # Format frontend code
make frontend-lint  # Lint frontend code
```

Backend-specific commands (from `backend/` directory):

```bash
make fmt        # Format with Black and Ruff
make lint       # Lint with Ruff
make typecheck  # Type check with MyPy
make security   # Security scan with Bandit
make audit      # Dependency audit with UV
make all        # Run all backend checks
```

This project is in early development. More documentation will be added as the project progresses.
