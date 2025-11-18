# Karst API Documentation

## Base URL
`http://localhost:8000/api/`

## Authentication
The API uses Token Authentication. Include the token in the Authorization header:
```
Authorization: Token <your-token>
```

## Endpoints

### Boulders

#### List Boulders
- **GET** `/boulders/`
- Returns a list of all boulders with basic info
- Query params: `search`, `ordering`

#### Get Boulder Detail
- **GET** `/boulders/{id}/`
- Returns detailed information about a boulder including all problems and images

#### Create Boulder
- **POST** `/boulders/`
- Requires authentication
- Body: `{ "name": "...", "description": "...", "latitude": "...", "longitude": "..." }`

#### Get Boulder Problems
- **GET** `/boulders/{id}/problems/`
- Returns all problems for a specific boulder

### Boulder Problems

#### List Problems
- **GET** `/problems/`
- Query params: `boulder`, `grade`, `search`, `ordering`

#### Get Problem Detail
- **GET** `/problems/{id}/`
- Returns detailed problem information with images and tick count

#### Create Problem
- **POST** `/problems/`
- Requires authentication
- Body: `{ "boulder": <id>, "name": "...", "grade": "V5", "description": "..." }`

### Images

#### List Images
- **GET** `/images/`
- Query params: `boulder`, `problem`, `is_primary`

#### Upload Image
- **POST** `/images/`
- Requires authentication
- Body: Form data with `image`, `boulder` or `problem`, `caption`, `is_primary`

### Users

#### Register
- **POST** `/users/register/`
- Body: `{ "username": "...", "email": "...", "password": "...", "password_confirm": "..." }`

#### Get Current User
- **GET** `/users/me/`
- Requires authentication
- Returns current user's profile

#### Get User Profile
- **GET** `/users/{id}/profile/`
- Returns user's profile information

### Comments

#### List Comments
- **GET** `/comments/`
- Query params: `problem` (filter by problem ID), `ordering`

#### Create Comment
- **POST** `/comments/`
- Requires authentication
- Body: `{ "problem": <id>, "content": "..." }`

#### Update Comment
- **PUT/PATCH** `/comments/{id}/`
- Requires authentication (only own comments)

### Ticks

#### List My Ticks
- **GET** `/ticks/my_ticks/`
- Requires authentication
- Returns all problems ticked by current user

#### Create Tick
- **POST** `/ticks/`
- Requires authentication
- Body: `{ "problem": <id>, "date": "YYYY-MM-DD", "notes": "..." }`

#### Delete Tick
- **DELETE** `/ticks/{id}/`
- Requires authentication

### Lists

#### List My Lists
- **GET** `/lists/`
- Requires authentication
- Returns all lists created by current user

#### Create List
- **POST** `/lists/`
- Requires authentication
- Body: `{ "name": "...", "description": "...", "is_public": false }`

#### Add Problem to List
- **POST** `/lists/{id}/add_problem/`
- Requires authentication
- Body: `{ "problem": <id>, "notes": "..." }`

#### Remove Problem from List
- **DELETE** `/lists/{id}/remove_problem/`
- Requires authentication
- Body: `{ "problem": <id> }`

## Models Overview

### Boulder
- Physical boulder at the crag
- Has latitude/longitude for map positioning
- Contains multiple BoulderProblems

### BoulderProblem
- Specific climbing problem on a boulder
- Has grade (V0-V16), name, description
- Can have multiple images
- Can be ticked by users
- Can have comments

### UserProfile
- Extended user information
- Bio, avatar, location
- Automatically created when user registers

### Comment
- Comments on boulder problems
- Tracks if comment was edited

### Tick
- User marking a problem as completed
- Includes date and optional notes
- One tick per user per problem

### UserList
- Custom lists users can create
- Can be public or private
- Contains multiple problems with notes

