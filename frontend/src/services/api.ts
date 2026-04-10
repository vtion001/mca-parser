import axios from 'axios';

const API_BASE = '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Bearer token and X-Account-ID from localStorage on every request.
// Also remove Content-Type for FormData so axios auto-sets multipart boundary.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('api_token');
  const accountId = localStorage.getItem('account_id');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (accountId) {
    config.headers['X-Account-ID'] = accountId;
  }
  // Let axios set Content-Type with boundary for FormData — don't override
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

// Persist token + account_id on successful login
api.interceptors.response.use((response) => {
  const { token, account_id } = response.data?.data ?? {};
  if (token) {
    localStorage.setItem('api_token', token);
  }
  if (account_id) {
    localStorage.setItem('account_id', String(account_id));
  }
  return response;
});

// Handle 401 errors - redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('api_token');
      localStorage.removeItem('account_id');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Document API
export const documentApi = {
  getAll: async (params?: { status?: string; document_type?: string; per_page?: number }) => {
    const response = await api.get('/documents', { params });
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/documents/${id}`);
    return response.data;
  },

  delete: async (id: number) => {
    const response = await api.delete(`/documents/${id}`);
    return response.data;
  },

  updateStatus: async (id: number, status: string) => {
    const response = await api.patch(`/documents/${id}/status`, { status });
    return response.data;
  },
};

// Batch API
export const batchApi = {
  getAll: async (params?: { status?: string; per_page?: number }) => {
    const response = await api.get('/batches', { params });
    return response.data;
  },

  create: async (data: { name?: string; document_ids: number[] }) => {
    const response = await api.post('/batches', data);
    return response.data;
  },

  getById: async (id: number) => {
    const response = await api.get(`/batches/${id}`);
    return response.data;
  },

  addDocuments: async (batchId: number, documentIds: number[]) => {
    const response = await api.post(`/batches/${batchId}/documents`, {
      document_ids: documentIds,
    });
    return response.data;
  },

  startProcessing: async (batchId: number) => {
    const response = await api.post(`/batches/${batchId}/process`);
    return response.data;
  },

  getProgress: async (batchId: number) => {
    const response = await api.get(`/batches/${batchId}/progress`);
    return response.data;
  },
};

// Comparison API
export const comparisonApi = {
  compare: async (documentIds: number[], type: 'balances' | 'risk' | 'transactions' | 'delta') => {
    const response = await api.post('/documents/compare', {
      document_ids: documentIds,
      type,
    });
    return response.data;
  },
};

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (name: string, email: string, password: string, accountId: number) => {
    const response = await api.post('/auth/register', { name, email, password, account_id: accountId });
    return response.data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('api_token');
      localStorage.removeItem('account_id');
      localStorage.removeItem('user');
    }
  },

  me: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Customer API
export const customerApi = {
  // Dashboard
  getDashboard: async () => {
    const response = await api.get('/customer/dashboard');
    return response.data;
  },

  // MCA Standing
  getMcaStanding: async () => {
    const response = await api.get('/customer/mca-standing');
    return response.data;
  },

  // Documents
  uploadDocument: async (formData: FormData) => {
    const response = await api.post('/customer/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  getDocuments: async (params?: { status?: string; document_type?: string; per_page?: number }) => {
    const response = await api.get('/customer/documents', { params });
    return response.data;
  },

  getDocument: async (id: number) => {
    const response = await api.get(`/customer/documents/${id}`);
    return response.data;
  },

  deleteDocument: async (id: number) => {
    const response = await api.delete(`/customer/documents/${id}`);
    return response.data;
  },
};

export default api;
