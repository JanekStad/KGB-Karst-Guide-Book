# Render.com Deployment Guide

This guide explains how to deploy the Karst backend to Render.com.

## Prerequisites

1. A Render.com account (sign up at https://render.com)
2. Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Render.com Setup Steps

### 1. Create a New Web Service

1. Go to your Render dashboard
2. Click "New +" → "Web Service"
3. Connect your repository
4. Select your repository and branch

### 2. Configure Build & Start Commands

**Name:** `karst-backend` (or your preferred name)

**Environment:** `Python 3`

**Root Directory:** `backend` (important! Set this to `backend` if your repo root is the parent directory)

**Build Command:**
```bash
pip install -r requirements.txt && python manage.py collectstatic --noinput
```

**Start Command:**
```bash
gunicorn karst_backend.wsgi:application --bind 0.0.0.0:$PORT
```

**OR** if you're using the `Procfile` (make sure Root Directory is set to `backend`):
- Render will automatically detect and use the `Procfile` if present
- The Procfile contains: `web: gunicorn karst_backend.wsgi:application --bind 0.0.0.0:$PORT`

**Note:** If your repository root is the `backend` directory, you can omit the Root Directory setting. Otherwise, set Root Directory to `backend` so Render knows where to find `manage.py` and `requirements.txt`.

### 3. Set Environment Variables

In the Render dashboard, go to "Environment" and add these variables:

#### Required Variables

- **`SECRET_KEY`**: Generate a new Django secret key (never use the default!)
  ```bash
  python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
  ```

- **`DEBUG`**: Set to `False` for production
  ```
  False
  ```

- **`ALLOWED_HOSTS`**: Your Render service URL (e.g., `karst-backend.onrender.com`)
  ```
  karst-backend.onrender.com
  ```
  Or if you have a custom domain:
  ```
  karst-backend.onrender.com,yourdomain.com,www.yourdomain.com
  ```

- **`CORS_ALLOWED_ORIGINS`**: Your frontend URL(s), comma-separated
  ```
  https://yourfrontend.onrender.com
  ```
  Or multiple:
  ```
  https://yourfrontend.onrender.com,https://www.yourdomain.com
  ```

#### Database Configuration

**Option 1: Use Render PostgreSQL Database (Recommended)**

1. Create a PostgreSQL database in Render:
   - Go to "New +" → "PostgreSQL"
   - Copy the "Internal Database URL"

2. Add environment variable:
   - **`DATABASE_URL`**: Paste the Internal Database URL
     ```
     postgresql://user:password@host:port/database
     ```

**Option 2: Use SQLite (Not Recommended for Production)**
- Don't set `DATABASE_URL` - it will default to SQLite
- ⚠️ **Warning**: SQLite will lose data on every deploy!

#### Optional Variables

- **`PYTHON_VERSION`**: `3.13.0` (or your preferred version)

### 4. Run Migrations

After the first deployment, you need to run migrations. You have two options:

**Option A: Using Render Shell (Recommended)**
1. Go to your service in Render dashboard
2. Click "Shell"
3. Run:
   ```bash
   cd backend && python manage.py migrate
   ```
4. (Optional) Create superuser:
   ```bash
   cd backend && python manage.py createsuperuser
   ```

**Option B: Using Build Command**
Add to your build command (not recommended, but works):
```bash
cd backend && pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
```

### 5. Deploy

Click "Create Web Service" or "Save Changes" to deploy.

## Post-Deployment Checklist

- [ ] Service is running and accessible
- [ ] Migrations have been run
- [ ] Superuser account created (if needed)
- [ ] CORS origins configured correctly
- [ ] Environment variables set (especially `SECRET_KEY` and `DEBUG=False`)
- [ ] Static files are being served (check `/static/` URLs)
- [ ] API endpoints are accessible

## Troubleshooting

### Static Files Not Loading

1. Ensure `collectstatic` is in your build command
2. Check that `STATIC_ROOT` is set correctly in `settings.py`
3. Verify WhiteNoise middleware is in `MIDDLEWARE`

### Database Connection Errors

1. Verify `DATABASE_URL` is set correctly
2. Check that PostgreSQL service is running
3. Ensure database name, user, and password are correct

### CORS Errors

1. Verify `CORS_ALLOWED_ORIGINS` includes your frontend URL
2. Check that URLs don't have trailing slashes
3. Ensure `CORS_ALLOW_CREDENTIALS=True` if needed

### 500 Internal Server Error

1. Check Render logs for specific errors
2. Verify all environment variables are set
3. Ensure `DEBUG=False` in production (not `True`!)

### Application Crashes on Start

1. Check that `gunicorn` is in `requirements.txt`
2. Verify the start command is correct
3. Check that `PORT` environment variable is used (Render sets this automatically)

## Updating Your Deployment

1. Push changes to your Git repository
2. Render will automatically detect and deploy (if auto-deploy is enabled)
3. Or manually trigger a deploy from the Render dashboard

## Additional Resources

- [Render Django Documentation](https://render.com/docs/django)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/)
- [WhiteNoise Documentation](http://whitenoise.evans.io/)

