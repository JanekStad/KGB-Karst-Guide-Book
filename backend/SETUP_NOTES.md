# Setup Notes

## Why Migrations Weren't Generated Initially

When the Django apps were created manually (because Django wasn't installed at the time), the `migrations` directories were not created.

### What Django's `startapp` Command Creates

When you run `python manage.py startapp appname`, Django automatically creates:
- `appname/__init__.py`
- `appname/models.py`
- `appname/views.py`
- `appname/admin.py`
- `appname/apps.py`
- **`appname/migrations/`** ← This was missing!
- **`appname/migrations/__init__.py`** ← This was missing!

### The Fix

The migrations directories were created when we ran:
```bash
python3 manage.py makemigrations boulders users comments lists
```

Django automatically created the `migrations` directories and `__init__.py` files, then generated the migration files.

### For Future Reference

If you create Django apps manually, make sure to:
1. Create the `migrations` directory
2. Create `migrations/__init__.py` (can be empty)
3. Or use `python manage.py startapp appname` which does this automatically

## Current Status

✅ All migrations directories now exist
✅ All migrations have been created
✅ All migrations have been applied
✅ Database tables are created

