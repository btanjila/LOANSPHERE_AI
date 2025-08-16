// frontend/src/utils/api.js
import axios from 'axios';

// Using your .env variable with fallback to the same URL
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for JWT token
api.interceptors.request.use(
  (config) => {
    const token = window.localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status } = error.response;
      
      if (status === 401) {
        // Clear token and redirect on unauthorized
        window.localStorage.removeItem('token');
        window.location.href = '/login';
      } else if (status === 403) {
        // Redirect on forbidden
        window.location.href = '/unauthorized';
      }
    }

    return Promise.reject(error);
  }
);

export default api;