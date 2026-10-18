const SAO_PAULO_TZ = 'America/Sao_Paulo';

/** Brasília é UTC-3 o ano todo (sem horário de verão desde 2019). */
const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Data de hoje (AAAA-MM-DD) em Brasília. Não usa toISOString() direto porque ele dá a data em UTC,
 * que já vira o dia seguinte a partir das 21h.
 */
export const todayISO = () => new Date(Date.now() - BRASILIA_OFFSET_MS).toISOString().split('T')[0];

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
