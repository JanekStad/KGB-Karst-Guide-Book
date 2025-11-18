# How to Start the Django Server

## The Problem

If you see the startup messages but `curl` fails, the server probably isn't actually running. This can happen if:
1. The script exits before the server starts
2. There's an error that's not being displayed
3. The server starts but immediately crashes

## Solution: Run the Server Manually

Instead of using the script, run these commands **one at a time** in your terminal:

### Step 1: Navigate to backend directory
```bash
cd backend
```

### Step 2: Activate virtual environment
```bash
source venv/bin/activate
```

You should see `(venv)` appear at the start of your prompt.

### Step 3: Run migrations (first time only)
```bash
python3 manage.py makemigrations
python3 manage.py migrate
```

### Step 4: Start the server
```bash
python3 manage.py runserver
```

## Expected Output

You should see output like this:

```
Watching for file changes with StatReloader
Performing system checks...

System check identified no issues (0 silenced).
Django version 4.2.26, using settings 'karst_backend.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CONTROL-C.
```

**Important:** The server will keep running and you'll see this output. The terminal will be "busy" - this is normal! The server is running.

## Test the Server

**In a NEW terminal window** (keep the server running in the first one), test with:

```bash
curl http://localhost:8000/api/
```

You should get a response (even if it's an error page, that means the server is running).

## Stop the Server

In the terminal where the server is running, press `Ctrl+C` to stop it.

## Troubleshooting

### If you see "ModuleNotFoundError"
- Make sure you activated the virtual environment (`source venv/bin/activate`)
- You should see `(venv)` in your prompt

### If the server exits immediately
- Check for errors in the output
- Try running: `python3 manage.py check` to see if there are configuration issues

### If port 8000 is already in use
- Use a different port: `python3 manage.py runserver 8001`
- Or find and kill the process using port 8000

