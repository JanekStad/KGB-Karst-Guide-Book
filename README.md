# Karst

A web and mobile application for managing a database of boulder problems for local crags.

## Features

- Database of boulder problems with detailed information
- Interactive map showing boulder positions
- Photo galleries for each boulder problem
- User tick tracking (mark problems as completed)
- Personal lists (save problems to custom lists)
- Comment system for each problem
- User authentication and profiles

## Project Structure

```
karst/
├── backend/          # Django backend API
├── frontend/         # React + Vite frontend
└── mobile/          # React Native mobile app (future)
```

## Tech Stack

### Backend
- Django
- Django REST Framework (for API)
- PostgreSQL (recommended) or SQLite (development)

### Frontend
- React
- Vite
- TypeScript (optional, but recommended)

### Mobile (Future)
- React Native

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Development

### Django Shell

The project includes `django-extensions` with `shell_plus` for an enhanced Django shell experience.

**Quick start:**
```bash
cd backend
./shell.sh
```

**To create a shell alias (add to your `~/.zshrc` or `~/.bashrc`):**
```bash
alias shell='cd /Users/Paysure/GIT/karst/backend && ./shell.sh'
```

After adding the alias, reload your shell config:
```bash
source ~/.zshrc  # or source ~/.bashrc
```

Then you can simply run:
```bash
shell
```

The shell will automatically:
- Import all your models (Crag, Wall, BoulderProblem, Tick, etc.)
- Use IPython for enhanced features
- Load common Django utilities

This project is in early development. More documentation will be added as the project progresses.

