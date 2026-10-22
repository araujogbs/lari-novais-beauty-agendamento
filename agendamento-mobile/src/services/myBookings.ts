import AsyncStorage from '@react-native-async-storage/async-storage';

/* Códigos secretos dos agendamentos feitos neste aparelho. Quem tem o código vê, paga o sinal e cancela;
   saber só o telefone não dá acesso a nada. */
const KEY = '@meus_agendamentos';
const MAX_TOKENS = 20;

export async function getBookingTokens(): Promise<string[]> {
  try {
    const raw: unknown = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
    return Array.isArray(raw) ? raw.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

/** Guarda o código (o mais novo primeiro, sem repetir). */
export async function addBookingToken(token: string): Promise<void> {
  try {
    const next = [token, ...(await getBookingTokens()).filter((t) => t !== token)].slice(0, MAX_TOKENS);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* sem armazenamento: só não lembra */
  }
}
