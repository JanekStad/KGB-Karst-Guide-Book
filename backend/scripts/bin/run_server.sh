#!/bin/bash

# Change to the backend directory (where manage.py and venv are located)
# Script is in backend/scripts/bin/, so go up two levels
cd "$(dirname "$0")/../.." || exit 1

# Activate virtual environment
source venv/bin/activate

# Run migrations
echo "Running migrations..."
python3 manage.py makemigrations 2>&1
python3 manage.py migrate 2>&1

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
python3 manage.py runserver 2>&1

