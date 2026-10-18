import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import type { BookingForm } from '../../hooks/useBookingForm';
import { common } from '../../styles/common';
import { THEME } from '../../theme';

/** Nome, WhatsApp, CEP (com taxa de deslocamento) e endereço. */
export function AddressSection({ form }: { form: BookingForm }) {
  const { feeEstimate } = form;

  return (
    <View style={common.formCard}>
      <Text style={common.inputLabel}>Seu Nome</Text>
      <TextInput
        style={common.textInput}
        value={form.clientName}
        onChangeText={form.setClientName}
        placeholder="Nome completo"
        placeholderTextColor={THEME.textMuted}
      />

      <Text style={[common.inputLabel, { marginTop: 12 }]}>WhatsApp</Text>
      <TextInput
        style={common.textInput}
        value={form.clientPhone}
        onChangeText={form.handlePhoneChange}
        placeholder="(11) 99999-9999"
        placeholderTextColor={THEME.textMuted}
        keyboardType="numeric"
        maxLength={15}
      />

      <Text style={[common.inputLabel, { marginTop: 12 }]}>CEP</Text>
      <TextInput
        style={common.textInput}
        value={form.clientCep}
        onChangeText={form.handleCepChange}
        placeholder="00000-000"
        placeholderTextColor={THEME.textMuted}
        keyboardType="numeric"
        maxLength={9}
      />
      {form.feeLoading ? (
        <View style={styles.feeCard}>
          <ActivityIndicator size="small" color={THEME.roseDark} />
          <Text style={styles.feeCardText}>Calculando deslocamento…</Text>
        </View>
      ) : feeEstimate ? (
        <View style={styles.feeCard}>
          <Text style={styles.feeCardText}>
            {feeEstimate.travelFee === 0
              ? `✨ Deslocamento gratuito (${feeEstimate.distanceKm} km do ateliê)`
              : `🚗 Distância: ${feeEstimate.distanceKm} km • Taxa de deslocamento (ida e volta): R$ ${feeEstimate.travelFee.toFixed(2)}`}
          </Text>
        </View>
      ) : form.feeError ? (
        <Text style={styles.feeErrorText}>{form.feeError}</Text>
      ) : null}

      <Text style={[common.inputLabel, { marginTop: 12 }]}>Endereço do Atendimento</Text>
      <TextInput
        style={[common.textInput, { height: 65, textAlignVertical: 'top' }]}
        value={form.clientAddress}
        onChangeText={form.setClientAddress}
        placeholder="Rua, Bairro"
        placeholderTextColor={THEME.textMuted}
        multiline
      />

      <Text style={[common.inputLabel, { marginTop: 12 }]}>Número e Complemento</Text>
      <TextInput
        style={common.textInput}
        value={form.addressNumber}
        onChangeText={form.setAddressNumber}
        placeholder="Ex.: 123, apto 45"
        placeholderTextColor={THEME.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  feeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: THEME.cream,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  feeCardText: { flex: 1, fontSize: 13, color: THEME.roseDark, fontWeight: '500' },
  feeErrorText: { marginTop: 8, fontSize: 12, color: '#b05050' },
});
