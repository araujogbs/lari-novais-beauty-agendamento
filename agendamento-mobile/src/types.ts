export interface ServiceItem {
  id: number;
  name: string;
  durationMinutes: number;
  price: number;
}

/**
 * Pending = em análise; Confirmed = aprovado; Rejected = recusado; Expired = ficou 3 dias sem resposta;
 * Cancelled = desmarcado; Blocked = bloqueio de agenda.
 */
export type AppointmentStatus = 'Pending' | 'Confirmed' | 'Rejected' | 'Expired' | 'Cancelled' | 'Blocked';

export interface AppointmentItem {
  id: number;
  clientName: string;
  clientPhone: string;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  serviceItem?: ServiceItem;
  clientAddress?: string;
  travelFee?: number | null;
  distanceKm?: number | null;
  description?: string;
  referenceImages?: string[];
  people?: number;
  /** Prazo para aprovar ou recusar (só nos pedidos em análise). */
  expiresAt?: string | null;
}

export interface MyAppointment {
  id: number;
  serviceName: string;
  price: number; // valor total do serviço (unitário x pessoas), sem deslocamento
  people?: number;
  startTime: string;
  endTime: string;
  clientAddress?: string;
  travelFee?: number | null;
  distanceKm?: number | null;
  status: AppointmentStatus;
}

export interface FeeEstimate {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  distanceKm: number;
  travelFee: number;
}

export type ViewMode = 'welcome' | 'client' | 'adminLogin' | 'admin' | 'myAppointments' | 'success';

export interface BookedSummary {
  phone: string;
  service: string;
  when: string;
  total: number;
}

export type ToastType = 'success' | 'error' | 'warn';

export interface ToastData {
  title: string;
  message: string;
  type: ToastType;
}

export type Notify = (title: string, message: string, type?: ToastType) => void;

export type LightboxSource = { uri: string; headers?: Record<string, string> };
export type OpenLightbox = (source: LightboxSource) => void;
