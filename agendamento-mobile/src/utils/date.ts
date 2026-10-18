const SAO_PAULO_TZ = 'America/Sao_Paulo';

export const todayISO = () => new Date().toISOString().split('T')[0];

/** "14:30" no fuso de Brasília a partir de um instante UTC da API. */
export const formatTimeBR = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', { timeZone: SAO_PAULO_TZ, hour: '2-digit', minute: '2-digit' });

/** "sex., 17/10" no fuso de Brasília. */
export const formatShortDateBR = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', {
    timeZone: SAO_PAULO_TZ,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

/** "sexta-feira, 17 de outubro" a partir de AAAA-MM-DD. */
export const formatLongDate = (dateStr: string) =>
  new Date(`${dateStr}T12:00:00`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

/** Brasília é UTC-3 sem horário de verão; a API recebe UTC. */
export const brasiliaToUtcIso = (dateStr: string, time: string) =>
  new Date(`${dateStr}T${time}:00-03:00`).toISOString();
