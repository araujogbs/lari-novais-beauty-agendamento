import React, { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { referenceImageSource } from '../../services/appointments';
import { common } from '../../styles/common';
import { THEME } from '../../theme';
import type { AppointmentItem, AppointmentStatus, Notify, OpenLightbox } from '../../types';
import { formatShortDateBR, formatTimeBR } from '../../utils/date';
import { formatBRL } from '../../utils/format';
import { animateLayout } from '../../utils/layoutAnimation';
import { openMap, openWhatsApp } from '../../utils/links';

interface Props {
  item: AppointmentItem;
  /** Token para carregar as fotos de referência (rota protegida). */
  token: string | null;
  notify: Notify;
  openLightbox: OpenLightbox;
  onCancel: (id: number) => void;
  onApprove: (id: number) => Promise<void>;
  onReject: (id: number, reason: string) => Promise<void>;
  onDepositPaid: (id: number) => Promise<void>;
  /** Mostra a data junto do horário (na lista de pedidos em análise, que mistura dias). */
  showDate?: boolean;
}

const BADGES: Record<AppointmentStatus, { text: string; color: string }> = {
  Pending: { text: 'Em análise', color: '#B7791F' },
  Confirmed: { text: 'Confirmado', color: '#386641' },
  Rejected: { text: 'Recusado', color: '#9E2A2B' },
  Expired: { text: 'Expirado sem resposta', color: '#9E2A2B' },
  Cancelled: { text: 'Cancelado', color: '#9E2A2B' },
  Blocked: { text: 'Bloqueado', color: THEME.text },
};

/** Um atendimento (ou bloqueio) na lista do painel da maquiadora. */
export function AdminAppointmentCard({
  item,
  token,
  notify,
  openLightbox,
  onCancel,
  onApprove,
  onReject,
  onDepositPaid,
  showDate,
}: Props) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const people = item.people ?? 1;
  const isPending = item.status === 'Pending';
  const isBlocked = item.status === 'Blocked';
  const isInactive = item.status === 'Cancelled' || item.status === 'Rejected' || item.status === 'Expired';
  const badge = BADGES[item.status] ?? BADGES.Confirmed;
  const servicesTotal = item.totalPrice ?? (item.serviceItem?.price ?? 0) * people;
  const owesDeposit = item.status === 'Confirmed' && !!item.depositAmount && !item.depositPaidAt;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const toggleReject = (open: boolean) => {
    animateLayout();
    setRejecting(open);
    if (!open) setReason('');
  };

  return (
    <View
      style={[
        common.adminCard,
        isInactive && styles.cardInactive,
        isBlocked && { backgroundColor: '#F8F8F8' },
        isPending && styles.cardPending,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={common.adminClientTitle}>{item.clientName}</Text>
        <Text style={common.adminSubText}>
          {item.serviceNames ?? item.serviceItem?.name ?? 'Serviço'}
          {people > 1 ? ` (${people} pessoas)` : ''} • {showDate ? `${formatShortDateBR(item.startTime)}, ` : ''}
          {formatTimeBR(item.startTime)} às {formatTimeBR(item.endTime)}
        </Text>
        <Text style={common.adminPhoneText}>WhatsApp: {item.clientPhone}</Text>
        {item.clientAddress ? <Text style={common.adminPhoneText}>Local: {item.clientAddress}</Text> : null}
        {item.travelFee != null && item.distanceKm != null ? (
          <Text style={common.adminPhoneText}>
            {item.travelFee > 0
              ? `🚗 ${item.distanceKm.toFixed(1)} km • Deslocamento: R$ ${formatBRL(item.travelFee)} • Total: R$ ${formatBRL(servicesTotal + item.travelFee)}`
              : `✨ ${item.distanceKm.toFixed(1)} km • Deslocamento gratuito`}
          </Text>
        ) : null}
        {item.status === 'Confirmed' && item.depositAmount ? (
          <Text style={common.adminPhoneText}>
            Sinal R$ {formatBRL(item.depositAmount)}: {item.depositPaidAt ? 'recebido' : 'aguardando pagamento'}
          </Text>
        ) : null}
        {item.description ? <Text style={common.adminPhoneText}>Pedido: {item.description}</Text> : null}
        {item.referenceImages && item.referenceImages.length > 0 && token ? (
          <View style={[common.imagesRow, { marginTop: 6 }]}>
            {item.referenceImages.map((name) => {
              const source = referenceImageSource(name, token);
              return (
                <TouchableOpacity key={name} activeOpacity={0.85} onPress={() => openLightbox(source)}>
                  <Image source={source} style={common.thumb} />
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
        {isBlocked && (
          <Text style={{ fontSize: 12, color: '#666666', marginTop: 4, fontStyle: 'italic' }}>
            Motivo: {item.clientName.replace('[BLOQUEIO] ', '')}
          </Text>
        )}
        <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
        {isPending && item.expiresAt ? (
          <Text style={styles.deadlineText}>
            Responder até {formatShortDateBR(item.expiresAt)}, {formatTimeBR(item.expiresAt)} (depois expira sozinho)
          </Text>
        ) : null}

        {owesDeposit && (
          <View style={styles.decisionRow}>
            <TouchableOpacity
              style={[styles.decisionBtn, styles.approveBtn]}
              disabled={busy}
              onPress={() => run(() => onDepositPaid(item.id))}
            >
              {busy ? (
                <ActivityIndicator size="small" color={THEME.white} />
              ) : (
                <>
                  <Ionicons name="cash-outline" size={16} color={THEME.white} />
                  <Text style={styles.approveText}>Sinal recebido</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Pedido em análise: aprovar ou recusar (com motivo opcional) */}
        {isPending && !rejecting && (
          <View style={styles.decisionRow}>
            <TouchableOpacity
              style={[styles.decisionBtn, styles.approveBtn]}
              disabled={busy}
              onPress={() => run(() => onApprove(item.id))}
            >
              {busy ? (
                <ActivityIndicator size="small" color={THEME.white} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color={THEME.white} />
                  <Text style={styles.approveText}>Aprovar</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.decisionBtn, styles.rejectBtn]}
              disabled={busy}
              onPress={() => toggleReject(true)}
            >
              <Ionicons name="close" size={16} color="#9E2A2B" />
              <Text style={styles.rejectText}>Recusar</Text>
            </TouchableOpacity>
          </View>
        )}
        {isPending && rejecting && (
          <View style={{ marginTop: 10 }}>
            <Text style={common.inputLabel}>Motivo (opcional, vai na mensagem para a cliente)</Text>
            <TextInput
              style={common.textInput}
              value={reason}
              onChangeText={setReason}
              placeholder="Ex.: já tenho um evento nesse dia"
              placeholderTextColor={THEME.textMuted}
              maxLength={300}
            />
            <View style={styles.decisionRow}>
              <TouchableOpacity style={[styles.decisionBtn, styles.neutralBtn]} disabled={busy} onPress={() => toggleReject(false)}>
                <Text style={styles.neutralText}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.decisionBtn, styles.rejectConfirmBtn]}
                disabled={busy}
                onPress={() => run(() => onReject(item.id, reason))}
              >
                {busy ? (
                  <ActivityIndicator size="small" color={THEME.white} />
                ) : (
                  <Text style={styles.approveText}>Confirmar recusa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {!isBlocked && !isInactive && (
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => openWhatsApp(item, notify)}>
            <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
          </TouchableOpacity>
          {item.clientAddress ? (
            <TouchableOpacity style={styles.quickBtn} onPress={() => openMap(item.clientAddress!, notify)}>
              <Ionicons name="location-outline" size={18} color={THEME.roseDark} />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {item.status === 'Confirmed' && (
        <TouchableOpacity style={common.cancelAction} onPress={() => onCancel(item.id)}>
          <Text style={common.cancelActionText}>Desmarcar</Text>
        </TouchableOpacity>
      )}

      {isBlocked && (
        <TouchableOpacity style={[common.cancelAction, { backgroundColor: '#FFE4B5' }]} onPress={() => onCancel(item.id)}>
          <Text style={common.cancelActionText}>Desbloquear</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  quickActions: {
    flexDirection: 'row',
    gap: 6,
    marginRight: 8,
  },
  quickBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: THEME.cream,
    borderWidth: 1,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInactive: {
    opacity: 0.5,
    backgroundColor: '#F2EFEB',
  },
  cardPending: {
    borderColor: '#E9C46A',
    backgroundColor: '#FFFBF0',
  },
  badgeText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  deadlineText: {
    marginTop: 2,
    fontSize: 11,
    color: THEME.textMuted,
  },
  decisionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  decisionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 9,
    borderRadius: 8,
    minHeight: 38,
  },
  approveBtn: { backgroundColor: '#386641' },
  approveText: { color: THEME.white, fontWeight: '600', fontSize: 13 },
  rejectBtn: { backgroundColor: '#FCECEB' },
  rejectText: { color: '#9E2A2B', fontWeight: '600', fontSize: 13 },
  rejectConfirmBtn: { backgroundColor: '#9E2A2B' },
  neutralBtn: { backgroundColor: THEME.cream, borderWidth: 1, borderColor: THEME.border },
  neutralText: { color: THEME.textLight, fontWeight: '500', fontSize: 13 },
});
