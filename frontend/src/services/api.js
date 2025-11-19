import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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

// Crags API
export const cragsAPI = {
  list: (params) => api.get('/crags/', { params }),
  get: (id) => api.get(`/crags/${id}/`),
  create: (data) => api.post('/crags/', data),
  update: (id, data) => api.put(`/crags/${id}/`, data),
  delete: (id) => api.delete(`/crags/${id}/`),
  getProblems: (id) => api.get(`/crags/${id}/problems/`),
  getWalls: (id) => api.get(`/crags/${id}/walls/`),
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
  create: (data) => api.post('/ticks/', data),
  delete: (id) => api.delete(`/ticks/${id}/`),
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
  getProfile: () => api.get('/users/me/'),
  getMyProfile: () => api.get('/profiles/me/'),
  updateProfile: (data) => api.patch('/profiles/me/', data),
};

export default api;

