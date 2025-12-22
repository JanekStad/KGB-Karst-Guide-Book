#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
# Navigate to backend directory (two levels up from scripts/bin/)
BACKEND_DIR="$( cd "$SCRIPT_DIR/../.." && pwd )"
cd "$BACKEND_DIR"

# Activate virtual environment
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
else
    echo "Error: Virtual environment not found. Please run from the backend directory."
    exit 1
fi

# Run Django shell_plus with IPython
python3 manage.py shell_plus --ipython

