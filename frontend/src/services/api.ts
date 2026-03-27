import axios from 'axios';

const API_BASE = '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

export default api;
