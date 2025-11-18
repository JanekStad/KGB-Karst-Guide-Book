import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Log startup message
console.log('%c🎯 Karst Frontend Starting...', 'color: #667eea; font-size: 16px; font-weight: bold;');
console.log('%c📝 All logs are prefixed with emojis for easy identification:', 'color: #2c3e50; font-size: 12px;');
console.log('  🚀 API Requests');
console.log('  ✅ API Success Responses');
console.log('  ❌ API Errors');
console.log('  📡 Data Fetching');
console.log('  🔷 Component Actions');
console.log('  🔝 Header/Navigation');
console.log('');
console.log('%c💡 Tip: Open DevTools (F12) to see detailed logs', 'color: #27ae60; font-size: 12px; font-weight: bold;');
console.log('');

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

