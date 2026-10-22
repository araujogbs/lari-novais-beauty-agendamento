import axios from 'axios';
import { authService } from './auth';

// Builds (preview/produção) falam com a API publicada. Em desenvolvimento (expo start) usa a API da sua máquina:
// ajuste o IP/porta abaixo ou defina EXPO_PUBLIC_API_URL (ex.: http://192.168.0.2:5102/api, http, sem certificado).
const PRODUCTION_API = 'https://api.larinovaisbeauty.com.br/api';
const LOCAL_API = 'http://192.168.0.2:5102/api';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? (__DEV__ ? LOCAL_API : PRODUCTION_API),
});

// Adicionar interceptor para incluir o token JWT nos headers
api.interceptors.request.use(
  async (config) => {
    const token = await authService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;