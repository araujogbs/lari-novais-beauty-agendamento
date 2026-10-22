import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { common } from '../../styles/common';
import { THEME } from '../../theme';
import type { ServiceItem } from '../../types';
import { formatLongDate } from '../../utils/date';
import { formatBRL, formatEstimatedRange } from '../../utils/format';

interface Props {
  services: ServiceItem[];
  date: string;
  slot: string;
  people: number;
  travelFee: number;
}

/** "Convite" com o resumo do agendamento e o valor. */
export function BookingTicket({ services, date, slot, people, travelFee }: Props) {
  const serviceTotal = services.reduce((sum, s) => sum + s.price, 0) * people;
  const durationMinutes = services.reduce((sum, s) => sum + s.durationMinutes, 0);

  return (
    <View style={styles.ticket}>
      <View style={styles.ticketHead}>
        <Ionicons name="sparkles" size={18} color={THEME.roseDark} />
        <Text style={styles.ticketKicker}>Seu convite</Text>
        <Ionicons name="sparkles" size={18} color={THEME.roseDark} />
      </View>
      <Text style={common.ticketService}>{services.map((s) => s.name).join(' + ')}</Text>
      <Text style={common.ticketDate}>{formatLongDate(date)}</Text>
      <View style={common.ticketDivider} />
      <View style={styles.ticketFooter}>
        <View>
          <Text style={common.ticketLabel}>Início → término previsto</Text>
          <Text style={styles.ticketValue}>{formatEstimatedRange(slot, durationMinutes, people)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={common.ticketLabel}>{travelFee > 0 ? 'Valor total' : 'Valor'}</Text>
          <Text style={common.ticketPrice}>R$ {formatBRL(serviceTotal + travelFee)}</Text>
          {travelFee > 0 ? (
            <Text style={common.ticketLabel}>
              Serviço R$ {formatBRL(serviceTotal)}
              {people > 1 ? ` (${people} pessoas)` : ''} + deslocamento R$ {formatBRL(travelFee)}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ticket: {
    marginTop: 20,
    backgroundColor: THEME.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.rose,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ticketKicker: { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: THEME.roseDark },
  ticketFooter: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  ticketValue: { fontSize: 15, fontWeight: '500', color: THEME.text, marginTop: 2 },
});
