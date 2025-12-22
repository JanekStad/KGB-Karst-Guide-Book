import axios from 'axios';

// Use environment variable or detect hostname dynamically
// When accessing from phone, use the same hostname as the frontend
const getApiBaseUrl = () => {
  // Check if we have an explicit API URL in environment
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // If accessing from a non-localhost address, use the same hostname
  const hostname = window.location.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `http://${hostname}:8000/api`;
  }
  
  // Default to localhost for local development
  return 'http://localhost:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8',
  },
  responseType: 'json',
  responseEncoding: 'utf8',
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Token ${token}`;
    }
    console.log('🚀 API Request:', {
      method: config.method.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      data: config.data,
      headers: config.headers,
    });
    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for logging
api.interceptors.response.use(
  (response) => {
    console.log('✅ API Response:', {
      status: response.status,
      url: response.config.url,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error('❌ API Error:', {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      data: error.response?.data,
      headers: error.response?.headers,
    });
    
    // Log full error for debugging
    if (error.response) {
      console.error('Full error response:', error.response);
    } else if (error.request) {
      console.error('Request was made but no response received:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data) => api.post('/users/register/', data),
  login: (username, password) => {
    return api.post('/auth/login/', { username, password });
  },
  getCurrentUser: () => api.get('/users/me/'),
  logout: () => {
    localStorage.removeItem('token');
  },
};

// Areas API (previously called crags)
export const areasAPI = {
  list: (params) => api.get('/areas/', { params }),
  get: (id) => api.get(`/areas/${id}/`),
  create: (data) => api.post('/areas/', data),
  update: (id, data) => api.put(`/areas/${id}/`, data),
  delete: (id) => api.delete(`/areas/${id}/`),
  getProblems: (id) => api.get(`/areas/${id}/problems/`),
  getSectors: (id) => api.get(`/areas/${id}/sectors/`),
};

// Backward compatibility: keep cragsAPI as alias
export const cragsAPI = areasAPI;

// Sectors API
export const sectorsAPI = {
  list: (params) => api.get('/sectors/', { params }),
  get: (id) => api.get(`/sectors/${id}/`),
  create: (data) => api.post('/sectors/', data),
  update: (id, data) => api.put(`/sectors/${id}/`, data),
  delete: (id) => api.delete(`/sectors/${id}/`),
  getProblems: (id) => api.get(`/sectors/${id}/problems/`),
  getWalls: (id) => api.get(`/sectors/${id}/walls/`),
};

// Walls API
export const wallsAPI = {
  list: (params) => api.get('/walls/', { params }),
  get: (id) => api.get(`/walls/${id}/`),
  create: (data) => api.post('/walls/', data),
  update: (id, data) => api.put(`/walls/${id}/`, data),
  delete: (id) => api.delete(`/walls/${id}/`),
  getProblems: (id) => api.get(`/walls/${id}/problems/`),
};

// Problems API
export const problemsAPI = {
  list: (params) => api.get('/problems/', { params }),
  get: (id) => api.get(`/problems/${id}/`),
  create: (data) => api.post('/problems/', data),
  update: (id, data) => api.put(`/problems/${id}/`, data),
  delete: (id) => api.delete(`/problems/${id}/`),
  getStatistics: (id) => api.get(`/problems/${id}/statistics/`),
};

// Images API
export const imagesAPI = {
  list: (params) => api.get('/images/', { params }),
  upload: (formData) => api.post('/images/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  }),
  delete: (id) => api.delete(`/images/${id}/`),
};

// Comments API
export const commentsAPI = {
  list: (params) => api.get('/comments/', { params }),
  create: (data) => api.post('/comments/', data),
  update: (id, data) => api.put(`/comments/${id}/`, data),
  delete: (id) => api.delete(`/comments/${id}/`),
};

// Ticks API
export const ticksAPI = {
  list: () => api.get('/ticks/my_ticks/'),
  get: (id) => api.get(`/ticks/${id}/`),
  create: (data) => api.post('/ticks/', data),
  update: (id, data) => api.put(`/ticks/${id}/`, data),
  patch: (id, data) => api.patch(`/ticks/${id}/`, data),
  delete: (id) => api.delete(`/ticks/${id}/`),
  importLezecDiary: (lezecUsername) => api.post('/ticks/import_lezec_diary/', { lezec_username: lezecUsername }),
  getStatistics: () => api.get('/ticks/statistics/'),
  getProblemTicks: (problemId) => api.get('/ticks/problem_ticks/', { params: { problem: problemId } }),
  getUserDiary: (userId) => api.get('/ticks/user_diary/', { params: { user: userId } }),
  getRecent: (limit = 20) => api.get('/ticks/recent/', { params: { limit } }),
  getCommunityStats: () => api.get('/ticks/community_stats/'),
};

// Lists API
export const listsAPI = {
  list: () => api.get('/lists/'),
  get: (id) => api.get(`/lists/${id}/`),
  create: (data) => api.post('/lists/', data),
  update: (id, data) => api.put(`/lists/${id}/`, data),
  delete: (id) => api.delete(`/lists/${id}/`),
  addProblem: (listId, data) => api.post(`/lists/${listId}/add_problem/`, data),
  removeProblem: (listId, problemId) => api.delete(`/lists/${listId}/remove_problem/`, {
    data: { problem: problemId },
  }),
};

// Users API
export const usersAPI = {
  list: (params) => api.get('/users/', { params }),
  get: (id) => api.get(`/users/${id}/`),
  getProfile: () => api.get('/users/me/'),
  getMyProfile: () => api.get('/profiles/me/'),
  updateProfile: (data) => api.patch('/profiles/me/', data),
  getUserTicks: (id) => api.get(`/users/${id}/ticks/`),
};

export default api;

