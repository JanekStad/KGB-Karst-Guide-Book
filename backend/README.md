# Karst Backend

Django REST API backend for the Karst boulder problems database.

## Setup Instructions

### 1. Create and Activate Virtual Environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Run Migrations

```bash
python3 manage.py makemigrations
python3 manage.py migrate
```

### 4. Create Superuser (Optional)

```bash
python3 manage.py createsuperuser
```

### 5. Run the Server

**Option 1: Using the helper script**
```bash
./run_server.sh
```

**Option 2: Manual activation**
```bash
source venv/bin/activate
python3 manage.py runserver
```

## Expected Output

When the server starts successfully, you should see:

```
Watching for file changes with StatReloader
Performing system checks...

System check identified no issues (0 silenced).
Django version 4.2.x, using settings 'karst_backend.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CONTROL-C.
```

The server will be available at:
- API: http://localhost:8000/api/
- Admin: http://localhost:8000/admin/

## Troubleshooting

### "ModuleNotFoundError: No module named 'django'"

**Solution:** Make sure you've activated the virtual environment:
```bash
source venv/bin/activate
```

You should see `(venv)` in your terminal prompt.

### Server exits immediately without output

**Solution:** Check if there are any errors:
```bash
python3 manage.py check
python3 manage.py runserver --verbosity 2
```

### Port 8000 already in use

**Solution:** Use a different port:
```bash
python3 manage.py runserver 8001
```

## API Documentation

See `API_DOCUMENTATION.md` for detailed API endpoint documentation.

