# Debugging Guide

## Viewing Logs

All logs are output to the browser console. To view them:

1. **Open Developer Tools:**
   - Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows/Linux)
   - Or right-click on the page and select "Inspect"

2. **Go to the Console tab** - This is where all logs appear

## Log Types

The application uses emoji-prefixed logs for easy identification:

- 🚀 **API Requests** - Every API call being made
- ✅ **API Success** - Successful API responses
- ❌ **API Errors** - Failed API calls with full error details
- 📡 **Data Fetching** - When components fetch data
- 🔷 **Component Actions** - Component lifecycle and user actions
- 🔝 **Header/Navigation** - Navigation and header updates
- 🎯 **App Level** - App-wide events

## What Gets Logged

### API Calls
- Request method, URL, headers, and data
- Response status, data, and headers
- Full error details including status codes and error messages

### Component Actions
- Component rendering
- State changes
- User interactions (clicks, form submissions)
- Data fetching operations

### Errors
- React component errors (caught by ErrorBoundary)
- API errors with full details
- Network errors
- Validation errors

## Error Boundary

If a React component crashes, you'll see:
- A user-friendly error message on the page
- Full error details in the console
- Stack trace information
- Option to navigate back to home

## Common Issues to Check

1. **CORS Errors**: Check if backend is running and CORS is configured
2. **404 Errors**: Verify API endpoints match backend routes
3. **401/403 Errors**: Check authentication token
4. **Network Errors**: Verify backend is running on `http://localhost:8000`

## Debugging Tips

1. **Filter Console**: Use the filter box to search for specific log types
2. **Preserve Log**: Check "Preserve log" to keep logs after page navigation
3. **Network Tab**: Check the Network tab to see actual HTTP requests/responses
4. **React DevTools**: Install React DevTools extension for component inspection

## Example Log Output

```
🚀 API Request: { method: 'GET', url: '/boulders/', ... }
✅ API Response: { status: 200, data: [...] }
📡 Fetching boulders...
✅ Boulders fetched successfully: [...]
```

If there's an error:
```
❌ API Error: { message: 'Network Error', status: undefined, ... }
❌ Failed to fetch boulders: Error: Network Error
Error details: { message: '...', response: undefined, ... }
```

