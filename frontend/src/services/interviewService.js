import { api } from './apiClient.js';

function unwrap(response) {
  const raw = response?.data ?? response;
  if (raw && typeof raw === 'object' && raw.success !== undefined && raw.data !== undefined) {
    return raw.data;
  }
  return raw;
}

export const InterviewAPI = {
  start: async () => {
    const response = await api.post('/interview/start');
    return unwrap(response);
  },

  getSession: async (sessionId) => {
    const response = await api.get(`/interview/${sessionId}`);
    return unwrap(response);
  },

  getStatus: async (sessionId) => {
    const response = await api.get(`/interview/${sessionId}/status`);
    return unwrap(response);
  },

  submitCode: async (sessionId, payload) => {
    const response = await api.post(`/interview/${sessionId}/submit-code`, payload);
    return unwrap(response);
  },

  qualify: async (sessionId) => {
    const response = await api.post(`/interview/${sessionId}/qualify`);
    return unwrap(response);
  },

  submitAnswer: async (sessionId, payload) => {
    const response = await api.post(`/interview/${sessionId}/answer`, payload);
    return unwrap(response);
  },

  terminate: async (sessionId) => {
    const response = await api.post(`/interview/${sessionId}/terminate`);
    return unwrap(response);
  },

  getQuestions: async (sessionId) => {
    const response = await api.get(`/ai/sessions/${sessionId}/questions`);
    return unwrap(response);
  },

  generateReport: async (sessionId) => {
    const response = await api.post(`/ai/sessions/${sessionId}/report/generate`);
    return unwrap(response);
  },

  getReport: async (sessionId) => {
    const response = await api.get(`/ai/sessions/${sessionId}/report`);
    return unwrap(response);
  },

  getStats: async () => {
    const response = await api.get('/interview/stats');
    return unwrap(response);
  }
};
