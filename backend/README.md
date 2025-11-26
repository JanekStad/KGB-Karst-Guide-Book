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

## Database Management

### Dump Boulder Data

To save all boulder-related data (areas, sectors, walls, problems) to a JSON fixture file:

```bash
python manage.py dump_boulders
# Or specify a custom output file:
python manage.py dump_boulders --output my_backup.json
```

This creates a `boulders_fixture.json` file that can be restored later.

### Load Boulder Data

To restore boulder data from a fixture file:

```bash
python manage.py load_boulders
# Or specify a custom input file:
python manage.py load_boulders --input my_backup.json
```

To clear existing data before loading (WARNING: This deletes all boulder data):

```bash
python manage.py load_boulders --clear
```

### Quick Database Reset

If you need to reset the database and restore from a fixture:

```bash
# 1. Delete the database
rm db.sqlite3

# 2. Run migrations
python manage.py migrate

# 3. Load the fixture
python manage.py load_boulders
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

## Environment Variables

Create a `.env` file in the `backend/` directory to configure environment-specific settings:

```bash
# Django Settings
SECRET_KEY=your-secret-key-here
DEBUG=True

# Allowed Hosts (comma-separated)
# For local development with mobile device access, add your computer's IP address
ALLOWED_HOSTS=localhost,127.0.0.1,YOUR_IP_ADDRESS

# CORS Allowed Origins (comma-separated)
# Add your computer's IP address when accessing from mobile devices on local network
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://YOUR_IP_ADDRESS:5173

# CSRF Trusted Origins (comma-separated)
# Required when accessing from mobile devices on local network
CSRF_TRUSTED_ORIGINS=http://YOUR_IP_ADDRESS:5173,http://YOUR_IP_ADDRESS:8000
```

**Note:** Replace `YOUR_IP_ADDRESS` with your actual computer's IP address (e.g., `192.168.1.XXX`). The `.env` file is gitignored and will not be committed to the repository.

### Accessing from Mobile Devices on Local Network

1. Find your computer's IP address:
   ```bash
   # macOS/Linux
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Or use
   ipconfig getifaddr en0  # macOS
   ```

2. Create/update `.env` file with your IP address (see above)

3. Run Django server bound to all interfaces:
   ```bash
   python3 manage.py runserver 0.0.0.0:8000
   ```

4. Run Vite dev server (frontend) bound to all interfaces:
   ```bash
   cd ../frontend
   npm run dev
   ```

5. Access from your phone: `http://YOUR_IP:5173`

## API Documentation

See `API_DOCUMENTATION.md` for detailed API endpoint documentation.

