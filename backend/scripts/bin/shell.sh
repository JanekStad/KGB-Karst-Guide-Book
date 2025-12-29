#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Navigate to backend directory (2 levels up from scripts/bin/)
BACKEND_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
cd "$BACKEND_DIR"

# Use UV if available, otherwise use traditional venv activation
if command -v uv >/dev/null 2>&1; then
    echo "Using UV for package management..."
    # UV: try auto-detection first (works if .venv symlink exists), fallback to explicit path
    if [ -L ".venv" ] || [ -d ".venv" ]; then
        uv run python manage.py shell_plus --ipython
    else
        uv run --python venv/bin/python manage.py shell_plus --ipython
    fi
else
    # Activate virtual environment
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    else
        echo "Error: Virtual environment not found. Please run from the backend directory."
        exit 1
    fi
    # Run Django shell_plus with IPython
    python3 manage.py shell_plus --ipython
fi

