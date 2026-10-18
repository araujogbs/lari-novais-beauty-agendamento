import { useCallback, useRef, useState } from 'react';
import type { Notify, ToastData } from '../types';

// Aviso na tela (Alert.alert não funciona no navegador, então usamos um banner em todas as plataformas)
export function useToast() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback<Notify>((title, message, type) => {
    const kind = type ?? (/sucesso|confirmado/i.test(title) ? 'success' : /atenção|horário/i.test(title) ? 'warn' : 'error');
    setToast({ title, message, type: kind });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);

  const dismiss = useCallback(() => setToast(null), []);

  return { toast, notify, dismiss };
}
