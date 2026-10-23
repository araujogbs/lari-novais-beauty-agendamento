import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Linking, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { SkeletonList } from '../../components/Skeleton';
import {
  approveAppointment,
  cancelAppointment,
  getAdminAppointments,
  getClientMessageUrl,
  getPendingAppointments,
  markDepositPaid,
  rejectAppointment,
} from '../../services/appointments';
import { authService } from '../../services/auth';
import { listenToPushEvents, registerForPushNotifications } from '../../services/pushNotifications';
import { common } from '../../styles/common';
import { THEME } from '../../theme';
import type { AppointmentItem, Notify, OpenLightbox } from '../../types';
import { todayISO } from '../../utils/date';
import { getErrorMessage } from '../../utils/errors';
import { AdminAppointmentCard } from './AdminAppointmentCard';
import { BlockSchedule } from './BlockSchedule';

interface Props {
  notify: Notify;
  openLightbox: OpenLightbox;
  /** Sem token válido: volta para o login. */
  onSessionExpired: () => void;
}

/** Painel Ateliê: pedidos em análise, agenda do dia, bloqueios e atalhos de cada atendimento. */
export function AdminScreen({ notify, openLightbox, onSessionExpired }: Props) {
  const [date, setDate] = useState(todayISO);
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [pending, setPending] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null); // para carregar as fotos (rota protegida)

  const handleAuthError = async (error: any): Promise<boolean> => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Token inválido ou expirado: faz logout e vai para o login
      await authService.removeToken();
      onSessionExpired();
      notify('Sessão expirada', 'Por favor, faça login novamente.');
      return true;
    }
    return false;
  };

  const load = async (dateStr: string) => {
    try {
      setLoading(true);
      setToken(await authService.getToken());
      const [day, requests] = await Promise.all([getAdminAppointments(dateStr), getPendingAppointments()]);
      setAppointments(day);
      setPending(requests);
    } catch (error: any) {
      console.error('Erro ao buscar agendamentos:', error.response?.status, error.response?.data);
      if (!(await handleAuthError(error))) {
        notify('Erro', 'Não foi possível carregar os agendamentos.');
      }
    } finally {
      setLoading(false);
    }
  };

  // O aviso push chama a versão mais recente de `load`, com o dia que está na tela
  const refresh = useRef<() => void>(() => {});
  useEffect(() => {
    refresh.current = () => load(date);
  });

  useEffect(() => {
    (async () => {
      if (!(await authService.isAuthenticated())) {
        onSessionExpired();
        return;
      }
      load(date);

      // Cadastra este aparelho para receber o aviso de pedido novo
      const push = await registerForPushNotifications();
      if (push === 'denied') {
        notify('Atenção', 'Sem a permissão de notificações você não é avisada dos pedidos novos. Ative nas configurações do celular.', 'warn');
      }
    })();
    // Pedido novo com o app aberto (ou toque no aviso): recarrega a lista na hora
    return listenToPushEvents(() => refresh.current());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Abre o WhatsApp da Lari na conversa com a cliente, com a mensagem pronta (confirmação com PIX, ou recusa). */
  const openClientMessage = async (id: number, reason?: string) => {
    try {
      await Linking.openURL(await getClientMessageUrl(id, reason));
    } catch {
      notify('Atenção', 'Não foi possível abrir o WhatsApp. Use "Enviar confirmação" no atendimento.', 'warn');
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await cancelAppointment(id);
      notify('Sucesso', 'Marcação desmarcada com sucesso.');
      load(date);
    } catch {
      notify('Erro', 'Falha ao desmarcar. Tente novamente.');
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approveAppointment(id);
      notify('Agendamento confirmado', 'Envie a confirmação, com o PIX do sinal, para a cliente pelo WhatsApp.', 'success');
      await load(date);
      await openClientMessage(id);
    } catch (error: any) {
      if (!(await handleAuthError(error))) {
        notify('Erro', getErrorMessage(error, 'Não foi possível aprovar o pedido.'));
        load(date);
      }
    }
  };

  const handleDepositPaid = async (id: number) => {
    try {
      await markDepositPaid(id);
      notify('Sinal recebido', 'O sinal foi registrado como pago.', 'success');
      await load(date);
    } catch (error: any) {
      if (!(await handleAuthError(error))) {
        notify('Erro', getErrorMessage(error, 'Não foi possível registrar o sinal.'));
      }
    }
  };

  const handleReject = async (id: number, reason: string) => {
    try {
      await rejectAppointment(id, reason);
      notify('Pedido recusado', 'O horário foi liberado. Avise a cliente pelo WhatsApp.', 'warn');
      await load(date);
      await openClientMessage(id, reason);
    } catch (error: any) {
      if (!(await handleAuthError(error))) {
        notify('Erro', getErrorMessage(error, 'Não foi possível recusar o pedido.'));
        load(date);
      }
    }
  };

  const renderCard = (item: AppointmentItem, showDate = false) => (
    <AdminAppointmentCard
      key={item.id}
      item={item}
      token={token}
      notify={notify}
      openLightbox={openLightbox}
      onCancel={handleCancel}
      onApprove={handleApprove}
      onReject={handleReject}
      onDepositPaid={handleDepositPaid}
      onSendMessage={openClientMessage}
      showDate={showDate}
    />
  );

  // Tudo rola junto: cabeçalho, pedidos em análise, bloqueio e calendário ficam no topo da lista do dia
  const header = (
    <>
      <View style={[common.header, { paddingHorizontal: 4 }]}>
        <Text style={common.title}>Painel de Atendimentos</Text>
        <Text style={common.subtitle}>Sua gestão de agenda a domicílio</Text>
      </View>

      {pending.length > 0 && (
        <View style={styles.pendingSection}>
          <Text style={styles.sectionTitle}>
            Pedidos em análise <Text style={styles.pendingCount}>({pending.length})</Text>
          </Text>
          <Text style={styles.sectionHint}>A cliente só recebe a confirmação depois que você aprovar.</Text>
          {pending.map((item) => renderCard(item, true))}
        </View>
      )}

      <View style={{ marginTop: 12 }}>
        <BlockSchedule date={date} notify={notify} onBlocked={() => load(date)} />
      </View>

      <View style={[common.calendarContainer, { marginTop: 16 }]}>
        <Calendar
          current={date}
          onDayPress={(day: any) => {
            setDate(day.dateString);
            load(day.dateString);
          }}
          markedDates={{
            [date]: {
              selected: true,
              selectedColor: THEME.text,
              selectedTextColor: THEME.white,
            },
          }}
          theme={{
            todayTextColor: THEME.roseDark,
            arrowColor: THEME.text,
          }}
        />
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Agenda do dia {date.split('-').reverse().join('/')}</Text>
    </>
  );

  return (
    <FlatList
      data={loading ? [] : appointments}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={[common.list, { paddingTop: 0 }]}
      ListHeaderComponent={header}
      ListEmptyComponent={
        loading ? (
          <SkeletonList height={80} />
        ) : (
          <View style={common.emptyContainer}>
            <Text style={common.emptyText}>Nenhum atendimento para esta data.</Text>
          </View>
        )
      }
      renderItem={({ item }) => renderCard(item)}
    />
  );
}

const styles = StyleSheet.create({
  pendingSection: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: THEME.roseDark,
    fontWeight: '600',
    marginBottom: 6,
  },
  pendingCount: {
    color: '#B7791F',
  },
  sectionHint: {
    fontSize: 12,
    color: THEME.textMuted,
    marginBottom: 10,
  },
});
