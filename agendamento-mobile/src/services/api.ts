import axios from 'axios';

// Substitua pelo IP da sua máquina local na porta da sua API .NET (ex: 5000 ou 5073)
// IMPORTANTE: Use http e não https para testes locais sem certificado configurado no celular
const api = axios.create({
  baseURL: 'http://192.168.0.2:5102/api', // Ajuste a porta conforme o console do 'dotnet run'
});

export default api;