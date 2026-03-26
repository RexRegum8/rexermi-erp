import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Request interceptor to add token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('rexer_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('rexer_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: (credentials: any) => api.post('/auth/login', credentials),
  getMe: () => api.get('/me'),
};

export const systemApi = {
  getHealth: () => api.get('/health'),
  getAuditLogs: (params = {}) => api.get('/system/audit', { params }),
  getUsers: () => api.get('/users'),
  getRoles: () => api.get('/roles'),
};
