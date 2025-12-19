# Karst Frontend

React + Vite frontend application for Karst boulder problems database.

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/     # Reusable React components
│   ├── Header.jsx
│   └── Header.css
├── pages/          # Page components
│   ├── Home.jsx
│   ├── Boulders.jsx
│   ├── BoulderDetail.jsx
│   ├── ProblemDetail.jsx
│   ├── Login.jsx
│   └── Register.jsx
├── services/       # API service functions
│   └── api.js
├── contexts/       # React contexts
│   └── AuthContext.jsx
├── hooks/          # Custom React hooks
├── utils/          # Utility functions
├── App.jsx         # Main app component
└── main.jsx        # Entry point
```

## Features

- **Home Page**: Welcome page with feature overview
- **Boulders List**: Browse all boulders with search functionality
- **Boulder Detail**: View boulder details, images, and problems
- **Problem Detail**: View problem details, images, comments, and tick functionality
- **Authentication**: Login and registration with token-based auth
- **Responsive Design**: Mobile-friendly layout

## API Integration

The frontend communicates with the Django backend API at `http://localhost:8000/api/`. Make sure the backend is running before starting the frontend.

## Authentication

The app uses token-based authentication. Tokens are stored in localStorage and automatically included in API requests.

## Documentation

Additional documentation is organized in the `docs/` folder:

- **`docs/reference/`** - Reference documentation
  - `DEBUGGING.md` - Debugging guide and logging information
  - `FRONTEND_DESIGN_PATTERN.md` - Design patterns and architecture guidelines

- **`docs/analysis/`** - Analysis and recommendations
  - `NAVIGATION_UX_ANALYSIS.md` - Navigation UX analysis
  - `RESPONSIVE_DESIGN_IMPROVEMENTS.md` - Responsive design improvements
  - `RESPONSIVE_DESIGN_VALIDATION.md` - Responsive design validation report
  - `HERO_CONTENT_IDEAS.md` - Hero section content ideas

- **`docs/implementation/`** - Implementation plans
  - `LOGO_IMPLEMENTATION_PLAN.md` - Logo implementation plan
  - `LOGO_SETUP.md` - Logo setup guide
