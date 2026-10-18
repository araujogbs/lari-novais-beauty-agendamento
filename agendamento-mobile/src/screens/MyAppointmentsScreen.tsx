import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { cancelAsClient, getMyAppointments } from '../services/appointments';
import { common } from '../styles/common';
import { THEME } from '../theme';
import type { MyAppointment, Notify } from '../types';
import { formatShortDateBR, formatTimeBR } from '../utils/date';
import { getErrorMessage } from '../utils/errors';
import { formatBRL, formatPhone } from '../utils/format';

interface Props {
  notify: Notify;
  /** Telefone para já buscar ao abrir (vem do agendamento recém-concluído). */
  initialPhone?: string;
}

export function MyAppointmentsScreen({ notify, initialPhone = '' }: Props) {
  const [phone, setPhone] = useState(initialPhone);
  const [appointments, setAppointments] = useState<MyAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);

  const search = async (phoneToSearch: string = phone) => {
    if (phoneToSearch.replace(/\D/g, '').length < 10) {
      notify('Atenção', 'Informe um WhatsApp válido.');
      return;
    }
    try {
      setLoading(true);
      setConfirmCancelId(null);
      setAppointments(await getMyAppointments(phoneToSearch));
      setSearched(true);
    } catch (error: any) {
      notify('Erro', getErrorMessage(error, 'Não foi possível buscar seus agendamentos.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPhone) search(initialPhone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = async (id: number) => {
    try {
      await cancelAsClient(id, phone);
      notify('Sucesso', 'Agendamento cancelado com sucesso.', 'success');
      setConfirmCancelId(null);
      search();
    } catch (error: any) {
      setConfirmCancelId(null);
      notify('Não foi possível cancelar', getErrorMessage(error, 'Falha ao cancelar o agendamento.'), 'error');
    }
  };

  return (
    <ScrollView contentContainerStyle={common.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={common.header}>
        <Text style={common.title}>Meus Agendamentos</Text>
        <Text style={common.subtitle}>Consulte ou cancele usando seu WhatsApp</Text>
      </View>

      <View style={common.formCard}>
        <Text style={common.inputLabel}>WhatsApp</Text>
        <TextInput
          style={common.textInput}
          value={phone}
          onChangeText={(t) => setPhone(formatPhone(t))}
          placeholder="(11) 99999-9999"
          placeholderTextColor={THEME.textMuted}
          keyboardType="numeric"
          maxLength={15}
        />
      </View>

      <TouchableOpacity style={[common.btnPrimary, { flex: 0, marginTop: 16 }]} onPress={() => search()} disabled={loading}>
        {loading ? <ActivityIndicator color={THEME.white} /> : <Text style={common.btnPrimaryText}>Buscar</Text>}
      </TouchableOpacity>

      {searched && appointments.length === 0 && (
        <View style={common.emptyContainer}>
          <Text style={common.emptyText}>Nenhum agendamento futuro para este número.</Text>
        </View>
      )}

      <View style={{ marginTop: 16 }}>
        {appointments.map((appt) => (
          <View key={appt.id} style={common.adminCard}>
            <View style={{ flex: 1 }}>
              <Text style={common.adminClientTitle}>{appt.serviceName}</Text>
              <Text style={[styles.status, appt.status === 'Pending' ? styles.statusPending : styles.statusConfirmed]}>
                {appt.status === 'Pending' ? 'Em análise' : 'Confirmado'}
              </Text>
              <Text style={common.adminSubText}>
                {formatShortDateBR(appt.startTime)} • {formatTimeBR(appt.startTime)} às {formatTimeBR(appt.endTime)} •{' '}
                {appt.people && appt.people > 1 ? `${appt.people} pessoas • ` : ''}R$ {formatBRL(appt.price + (appt.travelFee ?? 0))}
              </Text>
              {appt.travelFee ? (
                <Text style={common.adminPhoneText}>
                  Inclui deslocamento ({appt.distanceKm?.toFixed(1)} km): R$ {formatBRL(appt.travelFee)}
                </Text>
              ) : null}
              {appt.clientAddress ? <Text style={common.adminPhoneText}>Local: {appt.clientAddress}</Text> : null}
            </View>

            {confirmCancelId === appt.id ? (
              <View style={{ gap: 6 }}>
                <TouchableOpacity style={common.cancelAction} onPress={() => handleCancel(appt.id)}>
                  <Text style={common.cancelActionText}>Confirmar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[common.cancelAction, { backgroundColor: THEME.cream }]}
                  onPress={() => setConfirmCancelId(null)}
                >
                  <Text style={[common.cancelActionText, { color: THEME.textLight }]}>Voltar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={common.cancelAction} onPress={() => setConfirmCancelId(appt.id)}>
                <Text style={common.cancelActionText}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  status: { marginTop: 2, fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  statusPending: { color: '#B7791F' },
  statusConfirmed: { color: '#386641' },
});
