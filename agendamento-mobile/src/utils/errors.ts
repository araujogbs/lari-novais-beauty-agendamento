import api from '../services/api';

export const getErrorMessage = (error: any, fallback: string) => {
  if (error.response) return error.response.data?.message || fallback;
  if (error.request) return `Sem conexão com o servidor (${api.defaults.baseURL}). Verifique o Wi-Fi e tente novamente.`;
  return fallback;
};
