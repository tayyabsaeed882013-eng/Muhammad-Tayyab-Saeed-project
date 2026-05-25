import axios from 'axios';

// Create axios instance with base configuration
export const api = axios.create({
  baseURL: process.env.NODE_ENV === 'production' 
    ? 'https://your-api-domain.com/api'
    : 'http://localhost:5000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API endpoints
export const endpoints = {
  // Auth
  login: '/auth/login',
  logout: '/auth/logout',
  
  // Patients
  patients: '/patients',
  patient: (id: string) => `/patients/${id}`,
  
  // EEGs
  eegs: '/eegs',
  eeg: (id: string) => `/eegs/${id}`,
  uploadEEG: '/eegs/upload',
  downloadEEG: (id: string) => `/eegs/${id}/download`,
  
  // Dashboard
  dashboard: '/dashboard/stats',
};

// Utility functions for common API calls
export const authAPI = {
  login: (credentials: { username: string; password: string }) =>
    api.post(endpoints.login, credentials),
  logout: () => api.post(endpoints.logout),
};

export const patientsAPI = {
  getAll: () => api.get(endpoints.patients),
  getById: (id: string) => api.get(endpoints.patient(id)),
  create: (data: any) => api.post(endpoints.patients, data),
  update: (id: string, data: any) => api.put(endpoints.patient(id), data),
  delete: (id: string) => api.delete(endpoints.patient(id)),
};

export const eegsAPI = {
  getAll: () => api.get(endpoints.eegs),
  getById: (id: string) => api.get(endpoints.eeg(id)),
  upload: (formData: FormData) => api.post(endpoints.uploadEEG, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id: string, data: any) => api.put(endpoints.eeg(id), data),
  delete: (id: string) => api.delete(endpoints.eeg(id)),
  download: (id: string) => api.get(endpoints.downloadEEG(id), {
    responseType: 'blob'
  }),
};

export const dashboardAPI = {
  getStats: () => api.get(endpoints.dashboard),
};