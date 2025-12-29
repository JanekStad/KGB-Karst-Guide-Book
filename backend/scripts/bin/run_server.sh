#!/bin/bash

# Change to the backend directory (where manage.py and venv are located)
# Script is in backend/scripts/bin/, so go up two levels
cd "$(dirname "$0")/../.." || exit 1

# Use UV if available, otherwise use traditional venv activation
if command -v uv >/dev/null 2>&1; then
    # UV: try auto-detection first (works if .venv symlink exists), fallback to explicit path
    if [ -L ".venv" ] || [ -d ".venv" ]; then
        PYTHON_CMD="uv run python"
    else
        PYTHON_CMD="uv run --python venv/bin/python"
    fi
    echo "Using UV for package management..."
else
    # Activate virtual environment
    if [ -f "venv/bin/activate" ]; then
        source venv/bin/activate
    else
        echo "Error: Virtual environment not found. Please run from the backend directory."
        exit 1
    fi
    PYTHON_CMD="python3"
fi

# Run migrations
echo "Running migrations..."
$PYTHON_CMD manage.py makemigrations 2>&1
$PYTHON_CMD manage.py migrate 2>&1

# Check for errors
if [ $? -ne 0 ]; then
    echo "Error: Migrations failed. Please check the output above."
    exit 1
fi

# Start the server
echo ""
echo "Starting Django development server..."
echo "Server will be available at http://127.0.0.1:8000/"
echo "Press Ctrl+C to stop the server"
echo ""
$PYTHON_CMD manage.py runserver 2>&1

