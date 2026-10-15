import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

const TOKEN_KEY = '@auth_token';

export const authService = {
  async login(username: string, password: string) {
    try {
      const requestData = { Username: username, Password: password };
      const response = await api.post('/auth/login', requestData);
      const { token } = response.data;
      await AsyncStorage.setItem(TOKEN_KEY, token);
      return token;
    } catch (error: any) {
      // Não registrar credenciais nem tokens nos logs
      console.error('authService.login falhou:', error.response?.status ?? error.message);
      throw error;
    }
  },

  async getToken() {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    return token;
  },

  async removeToken() {
    await AsyncStorage.removeItem(TOKEN_KEY);
    console.log('Token removed');
  },

  async isAuthenticated() {
    const token = await this.getToken();
    const result = token !== null && token !== undefined && token.length > 0;
    console.log('authService.isAuthenticated returning:', result);
    return result;
  },

  // Alias for logout
  logout: () => authService.removeToken(),
};