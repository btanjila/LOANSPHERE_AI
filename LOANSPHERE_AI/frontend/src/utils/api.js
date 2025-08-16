//frontend/src/utils/api.js
import axios from 'axios';

// Create axios instance
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to include JWT token if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // JWT stored in localStorage
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // Not authenticated → redirect to login
      localStorage.removeItem('token'); // Clear invalid token
      window.location.href = '/login';
    } else if (status === 403) {
      // Authenticated but no permission → redirect to Unauthorized page
      window.location.href = '/unauthorized';
    }

    return Promise.reject(error);
  }
);

export default api;
