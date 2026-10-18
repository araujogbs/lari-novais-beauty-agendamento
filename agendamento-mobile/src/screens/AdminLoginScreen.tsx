import React, { useState } from 'react';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { authService } from '../services/auth';
import { common } from '../styles/common';
import { THEME } from '../theme';
import type { Notify } from '../types';
import { getErrorMessage } from '../utils/errors';

interface Props {
  notify: Notify;
  onLoggedIn: () => void;
}

export function AdminLoginScreen({ notify, onLoggedIn }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      notify('Atenção', 'Informe usuário e senha.');
      return;
    }
    setLoading(true);
    try {
      await authService.login(username.trim(), password);
      onLoggedIn();
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 401) {
        notify('Acesso negado', 'Usuário ou senha incorretos.');
      } else if (status === 503) {
        notify('Login indisponível', 'O servidor ainda não tem o usuário administrador configurado.');
      } else {
        notify('Erro ao entrar', getErrorMessage(error, 'Não foi possível fazer login.'));
      }
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={common.welcomeTitle}>
        Lari Novais <Text style={common.brandSubtitle}>Beauty</Text>
      </Text>
      <Text style={common.welcomeTagline}>Painel Ateliê</Text>

      <View style={common.formCard}>
        <Text style={common.inputLabel}>Usuário</Text>
        <TextInput
          style={common.textInput}
          value={username}
          onChangeText={setUsername}
          placeholder="Usuário"
          placeholderTextColor={THEME.textMuted}
          autoCapitalize="none"
        />

        <Text style={[common.inputLabel, { marginTop: 12 }]}>Senha</Text>
        <TextInput
          style={common.textInput}
          value={password}
          onChangeText={setPassword}
          placeholder="Senha"
          placeholderTextColor={THEME.textMuted}
          secureTextEntry
        />
      </View>

      <TouchableOpacity style={common.btnPrimary} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color={THEME.white} /> : <Text style={common.btnPrimaryText}>Entrar</Text>}
      </TouchableOpacity>
    </View>
  );
}
