# Django Development Tips

## Auto-Reload Feature

Django's development server (`python manage.py runserver`) **automatically reloads** when it detects changes to Python files.

### What Triggers Auto-Reload

The server will automatically restart when you modify:
- ✅ Python files (`.py`) - models, views, settings, etc.
- ✅ Settings files
- ✅ URL configurations
- ✅ Templates (if using template-based views)

### What Does NOT Trigger Auto-Reload

- ❌ Database migrations (but you don't need to restart - see below)
- ❌ Static files (CSS, JS) - these are served directly
- ❌ Media files

## Database Migrations

**Good news:** You do NOT need to restart the server after applying migrations!

### Why?

Django reads from the database on each request. When you run:
```bash
python manage.py migrate
```

The database schema changes immediately. The next API request will use the new schema - no restart needed.

### Example Workflow

1. Modify `models.py` (add a field, change a model)
2. Create migration: `python manage.py makemigrations`
3. Apply migration: `python manage.py migrate`
4. **Server keeps running** - no restart needed!
5. Test the API - changes are already active

## When You DO Need to Restart

You only need to manually restart if:
- The server crashes
- You change environment variables (if not using a reloader that watches `.env`)
- You modify `manage.py` or Django core files
- The auto-reload fails for some reason

## How to Check if Auto-Reload is Working

When you start the server, you'll see:
```
Watching for file changes with StatReloader
```

This confirms auto-reload is active. If you modify a Python file, you'll see:
```
Watching for file changes with StatReloader
Performing system checks...
System check identified no issues (0 silenced).
```

This means the server detected the change and reloaded.

## Best Practice

1. **Keep the server running** in one terminal
2. **Make changes** to your code
3. **Watch the terminal** - you'll see it auto-reload
4. **Test immediately** - no manual restart needed!

## Troubleshooting

If auto-reload isn't working:
- Check that you see "Watching for file changes with StatReloader"
- Make sure you're editing Python files (not just database)
- Try saving the file again (some editors don't trigger file system events)
- As a last resort, manually restart: `Ctrl+C` then `python manage.py runserver`

