import React, { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { common } from '../styles/common';
import { THEME } from '../theme';
import type { BookedSummary } from '../types';
import { formatBRL } from '../utils/format';

const AUTO_ADVANCE_MS = 6000;

interface Props {
  booked: BookedSummary;
  onContinue: () => void;
}

export function SuccessScreen({ booked, onContinue }: Props) {
  // Leva a cliente para "Meus Agendamentos" depois de alguns segundos
  useEffect(() => {
    const t = setTimeout(onContinue, AUTO_ADVANCE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.successWrap}>
      <View style={styles.successIcon}>
        <Ionicons name="checkmark" size={44} color={THEME.white} />
      </View>
      <Text style={styles.successTitle}>Agendamento em análise</Text>
      <Text style={styles.successSub}>Você receberá a confirmação pelo WhatsApp.</Text>
      <View style={styles.successCard}>
        <Text style={common.ticketService}>{booked.service}</Text>
        <Text style={common.ticketDate}>{booked.when}</Text>
        <View style={common.ticketDivider} />
        <Text style={common.ticketLabel}>Valor total</Text>
        <Text style={common.ticketPrice}>R$ {formatBRL(booked.total)}</Text>
      </View>
      <TouchableOpacity style={[common.btnPrimary, { flex: 0, alignSelf: 'stretch' }]} onPress={onContinue}>
        <Text style={common.btnPrimaryText}>Ver meus agendamentos</Text>
      </TouchableOpacity>
      <Text style={styles.successHint}>Você será levada para seus agendamentos em instantes…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  successIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: THEME.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 26, fontWeight: '600', color: THEME.text, marginTop: 8, textAlign: 'center' },
  successSub: { fontSize: 14, color: THEME.textLight, textAlign: 'center' },
  successCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    padding: 20,
    marginVertical: 8,
    borderRadius: 16,
    backgroundColor: THEME.white,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  successHint: { fontSize: 12, color: THEME.textMuted, textAlign: 'center' },
});
