import { Linking } from 'react-native';
import type { AppointmentItem, Notify } from '../types';

export const openWhatsApp = (item: AppointmentItem, notify: Notify) => {
  let phone = item.clientPhone.replace(/\D/g, '');
  if (phone.length <= 11) phone = `55${phone}`; // sem DDI
  const text = `Olá ${item.clientName}, tudo bem? Passando para confirmar seu atendimento de ${item.serviceItem?.name}.`;
  Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`).catch(() =>
    notify('Erro', 'Não foi possível abrir o WhatsApp.'),
  );
};

export const openMap = (address: string, notify: Notify) => {
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`).catch(() =>
    notify('Erro', 'Não foi possível abrir o mapa.'),
  );
};
