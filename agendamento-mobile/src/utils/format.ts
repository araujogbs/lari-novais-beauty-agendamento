export const formatBRL = (v: number) => v.toFixed(2).replace('.', ',');

export const formatPhone = (text: string) => {
  const raw = text.replace(/\D/g, '');
  let formatted = raw;
  if (raw.length > 2) {
    formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
  }
  if (raw.length > 7) {
    formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
  }
  return formatted;
};

export const formatCep = (text: string) => {
  const raw = text.replace(/\D/g, '').slice(0, 8);
  return raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
};

export const isValidTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

/** O slot é o horário de INÍCIO; o atendimento termina duração x pessoas depois. */
export const formatEstimatedRange = (slot: string, durationMinutes: number, people: number) => {
  const [h, m] = slot.split(':').map(Number);
  const total = Math.min(h * 60 + m + durationMinutes * people, 23 * 60 + 59);
  const end = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  return `${slot} às ${end}`;
};
