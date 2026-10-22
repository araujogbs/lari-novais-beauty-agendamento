import { Platform } from 'react-native';
import type { ImagePickerAsset } from 'expo-image-picker';
import api from './api';
import type { AppointmentItem, FeeEstimate, LightboxSource, MyAppointment, ServiceItem } from '../types';

/* ---------- cliente ---------- */

export const getServices = async () => (await api.get<ServiceItem[]>('/services')).data;

export const getAvailableSlots = async (serviceIds: number[], date: string, people: number) =>
  (await api.get<string[]>('/appointments/available-slots', { params: { serviceIds: serviceIds.join(','), date, people } }))
    .data;

export const estimateFee = async (cep: string) =>
  (await api.get<FeeEstimate>('/appointments/estimate-fee', { params: { cep } })).data;

export interface BookingPayload {
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  cep?: string; // só enviado quando a taxa foi calculada
  description: string;
  serviceItemIds: number[]; // um ou mais serviços: valor e duração somam
  startTime: string; // ISO/UTC: início do atendimento
  people: number;
  images: ImagePickerAsset[];
}

export const createAppointment = (payload: BookingPayload) => {
  // multipart/form-data: campos de texto + fotos de referência
  const form = new FormData();
  form.append('clientName', payload.clientName);
  form.append('clientPhone', payload.clientPhone);
  form.append('clientAddress', payload.clientAddress);
  if (payload.cep) form.append('cep', payload.cep);
  form.append('description', payload.description);
  payload.serviceItemIds.forEach((id) => form.append('serviceItemIds', String(id)));
  form.append('startTime', payload.startTime);
  form.append('people', String(payload.people));
  payload.images.forEach((img, i) => {
    if (Platform.OS === 'web' && img.file) {
      form.append('images', img.file);
    } else {
      form.append('images', {
        uri: img.uri,
        name: img.fileName ?? `referencia-${i + 1}.jpg`,
        type: img.mimeType ?? 'image/jpeg',
      } as any);
    }
  });

  return api.post('/appointments', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    transformRequest: (data) => data, // evita o axios serializar o FormData
  });
};

export const getMyAppointments = async (phone: string) =>
  (await api.get<MyAppointment[]>('/appointments/my-appointments', { params: { phone } })).data;

export const cancelAsClient = (id: number, phone: string) => api.post(`/appointments/${id}/client-cancel`, { phone });

/* ---------- maquiadora (rotas protegidas) ---------- */

export const getAdminAppointments = async (date: string) =>
  (await api.get<AppointmentItem[]>('/appointments', { params: { date } })).data;

/** Pedidos futuros em análise, de qualquer data. */
export const getPendingAppointments = async () => (await api.get<AppointmentItem[]>('/appointments/pending')).data;

/** Aprova o pedido: a cliente recebe a confirmação e o evento vai para a agenda. */
export const approveAppointment = (id: number) => api.post(`/appointments/${id}/approve`);

/** Recusa o pedido: libera o horário e avisa a cliente (com o motivo, se houver). */
export const rejectAppointment = (id: number, reason?: string) =>
  api.post(`/appointments/${id}/reject`, { reason: reason?.trim() || undefined });

/** Marca que o sinal do pedido confirmado foi recebido. */
export const markDepositPaid = (id: number) => api.post(`/appointments/${id}/deposit-paid`);

// A API espera uma string JSON (com aspas); o axios enviaria Cancelled cru e dava 400
export const cancelAppointment = (id: number) =>
  api.patch(`/appointments/${id}/status`, JSON.stringify('Cancelled'), {
    headers: { 'Content-Type': 'application/json' },
  });

export interface BlockSlotPayload {
  date: string;
  reason?: string;
  startTime?: string;
  endTime?: string;
}

export const blockSlot = (payload: BlockSlotPayload) => api.post('/appointments/block-slot', payload);

/** Foto de referência: rota protegida, então precisa do token no header. */
export const referenceImageSource = (name: string, token: string): LightboxSource => ({
  uri: `${api.defaults.baseURL}/appointments/images/${name}`,
  headers: { Authorization: `Bearer ${token}` },
});
