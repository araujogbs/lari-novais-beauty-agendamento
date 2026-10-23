import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { THEME } from '../theme';
import api from './api';

const TOKEN_KEY = '@push_token';
const CHANNEL_ID = 'pedidos';

// Com o app aberto, o aviso aparece do mesmo jeito (sem um handler o Expo o esconde)
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type PushSetup = 'ok' | 'denied' | 'unsupported';

/**
 * Pede permissão, obtém o token do Expo e cadastra este aparelho na API para receber o aviso de pedido novo.
 * 'unsupported': navegador, Expo Go no Android ou app sem o projectId do EAS (veja README).
 */
export async function registerForPushNotifications(): Promise<PushSetup> {
  if (Platform.OS === 'web') return 'unsupported';

  try {
    // No Android 13+ a permissão só é pedida depois que existe um canal de notificação
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Pedidos de agendamento',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: THEME.rose,
      });
    }

    let permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) permission = await Notifications.requestPermissionsAsync();
    if (!permission.granted) return 'denied';

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) {
      console.warn('Push: projectId do EAS ausente (rode "eas init").');
      return 'unsupported';
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.post('/push/register', { token });
    await AsyncStorage.setItem(TOKEN_KEY, token);
    return 'ok';
  } catch (error: any) {
    console.warn('Push: não foi possível cadastrar o aparelho:', error?.message ?? error);
    return 'unsupported';
  }
}

/** Ao sair do painel: o aparelho para de receber os avisos (precisa ser chamado antes de apagar o login). */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (!token) return;
    await api.post('/push/unregister', { token });
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch (error: any) {
    console.warn('Push: não foi possível descadastrar o aparelho:', error?.message ?? error);
  }
}

/** Chama `onEvent` quando chega um aviso com o app aberto ou quando a maquiadora toca nele. Devolve a função que cancela. */
export function listenToPushEvents(onEvent: () => void): () => void {
  if (Platform.OS === 'web') return () => {};
  const received = Notifications.addNotificationReceivedListener(onEvent);
  const tapped = Notifications.addNotificationResponseReceivedListener(onEvent);
  return () => {
    received.remove();
    tapped.remove();
  };
}
