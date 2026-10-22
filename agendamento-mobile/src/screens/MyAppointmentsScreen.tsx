import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { cancelAsClient, lookupMyAppointments } from '../services/appointments';
import { getBookingTokens } from '../services/myBookings';
import { common } from '../styles/common';
import { THEME } from '../theme';
import type { MyAppointment, Notify } from '../types';
import { formatShortDateBR, formatTimeBR } from '../utils/date';
import { getErrorMessage } from '../utils/errors';
import { formatBRL } from '../utils/format';

interface Props {
  notify: Notify;
}

/** Só aparecem os agendamentos cujo código secreto está neste aparelho (feitos aqui). */
export function MyAppointmentsScreen({ notify }: Props) {
  const [appointments, setAppointments] = useState<MyAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasTokens, setHasTokens] = useState(true);
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const copyPix = async (appt: MyAppointment) => {
    if (!appt.pixCode) return;
    try {
      await Clipboard.setStringAsync(appt.pixCode);
      setCopiedId(appt.id);
    } catch {
      notify('Erro', 'Não foi possível copiar o código PIX.');
    }
  };

  const search = async () => {
    try {
      setLoading(true);
      setConfirmCancelId(null);
      const tokens = await getBookingTokens();
      setHasTokens(tokens.length > 0);
      setAppointments(tokens.length ? await lookupMyAppointments(tokens) : []);
    } catch (error: any) {
      notify('Erro', getErrorMessage(error, 'Não foi possível buscar seus agendamentos.'));
    } finally {
      setLoading(false);
    }
  };

  // Busca ao abrir a tela
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = async (appt: MyAppointment) => {
    try {
      await cancelAsClient(appt.id, appt.manageToken);
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
        <Text style={common.subtitle}>Os agendamentos feitos neste aparelho</Text>
      </View>

      {loading && <ActivityIndicator color={THEME.roseDark} style={{ marginTop: 24 }} />}

      {!loading && appointments.length === 0 && (
        <View style={common.emptyContainer}>
          <Text style={common.emptyText}>
            {hasTokens
              ? 'Nenhum agendamento futuro.'
              : 'Nenhum agendamento neste aparelho. Por segurança, só aparecem os agendamentos feitos aqui. Precisa de ajuda? Fale com a Lari pelo WhatsApp.'}
          </Text>
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
              {appt.status === 'Confirmed' && appt.depositAmount && !appt.depositPaid ? (
                <View style={styles.depositBox}>
                  <Text style={styles.depositText}>
                    Sinal para garantir o horário: R$ {formatBRL(appt.depositAmount)}
                    {appt.pixCode ? ' (PIX copia e cola)' : '. A Lari envia a chave PIX por WhatsApp.'}
                  </Text>
                  {appt.pixCode ? (
                    <>
                      <Text style={styles.pixCode} selectable numberOfLines={3}>
                        {appt.pixCode}
                      </Text>
                      <TouchableOpacity style={[common.btnPrimary, { flex: 0, marginTop: 8 }]} onPress={() => copyPix(appt)}>
                        <Text style={common.btnPrimaryText}>{copiedId === appt.id ? 'Código copiado!' : 'Copiar PIX'}</Text>
                      </TouchableOpacity>
                    </>
                  ) : null}
                </View>
              ) : null}
              {appt.status === 'Confirmed' && appt.depositPaid ? (
                <Text style={styles.depositText}>Sinal recebido. Obrigada!</Text>
              ) : null}
            </View>

            {confirmCancelId === appt.id ? (
              <View style={{ gap: 6 }}>
                <TouchableOpacity style={common.cancelAction} onPress={() => handleCancel(appt)}>
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
  depositBox: { marginTop: 8 },
  depositText: { marginTop: 6, fontSize: 12, color: THEME.text },
  pixCode: {
    marginTop: 6,
    padding: 8,
    fontSize: 11,
    color: THEME.textLight,
    backgroundColor: THEME.cream,
    borderRadius: 6,
  },
});
