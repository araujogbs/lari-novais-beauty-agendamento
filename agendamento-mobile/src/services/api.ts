import axios from 'axios';
import { authService } from './auth';

// Substitua pelo IP da sua máquina local na porta da sua API .NET (ex: 5000 ou 5073)
// IMPORTANTE: Use http e não https para testes locais sem certificado configurado no celular
const api = axios.create({
  baseURL: 'http://192.168.0.2:5102/api', // Ajuste a porta conforme o console do 'dotnet run'
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