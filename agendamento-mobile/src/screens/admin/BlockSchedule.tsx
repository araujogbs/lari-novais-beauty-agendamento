import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { blockSlot, BlockSlotPayload } from '../../services/appointments';
import { common } from '../../styles/common';
import { THEME } from '../../theme';
import type { Notify } from '../../types';
import { getErrorMessage } from '../../utils/errors';
import { isValidTime } from '../../utils/format';
import { animateLayout } from '../../utils/layoutAnimation';

const WORK_START = '06:00';
const WORK_END = '22:00';

interface Props {
  /** Dia selecionado no painel (AAAA-MM-DD). */
  date: string;
  notify: Notify;
  onBlocked: () => void;
}

/** Botão "Bloquear Agenda" que abre o formulário de bloqueio (dia inteiro ou intervalo de horas). */
export function BlockSchedule({ date, notify, onBlocked }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'day' | 'range'>('day');
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('15:00');
  const [reason, setReason] = useState('Folga');

  const toggle = (next: boolean) => {
    animateLayout();
    setOpen(next);
  };

  const handleSave = async () => {
    const payload: BlockSlotPayload = { date, reason: reason.trim() || undefined };

    if (mode === 'range') {
      if (!isValidTime(start) || !isValidTime(end)) {
        notify('Atenção', 'Use o formato HH:mm (ex: 09:00).');
        return;
      }
      if (start >= end) {
        notify('Atenção', 'O início deve ser anterior ao fim.');
        return;
      }
      if (start < WORK_START || end > WORK_END) {
        notify('Atenção', `O intervalo deve estar entre ${WORK_START} e ${WORK_END}.`);
        return;
      }
      payload.startTime = `${start}:00`;
      payload.endTime = `${end}:00`;
    }

    try {
      await blockSlot(payload);
      notify('Sucesso', mode === 'day' ? 'Dia bloqueado com sucesso!' : 'Intervalo bloqueado com sucesso!');
      setOpen(false);
      onBlocked();
    } catch (error: any) {
      console.error('Erro ao bloquear agenda:', error);
      notify('Erro', getErrorMessage(error, 'Falha ao bloquear a agenda.'));
    }
  };

  if (!open) {
    return (
      <TouchableOpacity style={common.btnPrimary} onPress={() => toggle(true)}>
        <Text style={common.btnPrimaryText}>Bloquear Agenda</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={common.formCard}>
      <Text style={common.inputLabel}>Bloquear {date.split('-').reverse().join('/')}</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <TouchableOpacity
          style={[common.slotBadge, mode === 'day' && common.slotBadgeActive]}
          onPress={() => setMode('day')}
        >
          <Text style={[common.slotBadgeText, mode === 'day' && common.slotBadgeTextActive]}>Dia Inteiro</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[common.slotBadge, mode === 'range' && common.slotBadgeActive]}
          onPress={() => setMode('range')}
        >
          <Text style={[common.slotBadgeText, mode === 'range' && common.slotBadgeTextActive]}>Intervalo de Horas</Text>
        </TouchableOpacity>
      </View>

      {mode === 'range' && (
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={common.inputLabel}>Início</Text>
            <TextInput
              style={common.textInput}
              value={start}
              onChangeText={setStart}
              placeholder="09:00"
              placeholderTextColor={THEME.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={common.inputLabel}>Fim</Text>
            <TextInput
              style={common.textInput}
              value={end}
              onChangeText={setEnd}
              placeholder="15:00"
              placeholderTextColor={THEME.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
        </View>
      )}

      <Text style={common.inputLabel}>Motivo</Text>
      <TextInput
        style={common.textInput}
        value={reason}
        onChangeText={setReason}
        placeholder="Folga, Férias, Compromisso..."
        placeholderTextColor={THEME.textMuted}
      />

      <View style={common.actionButtons}>
        <TouchableOpacity style={common.btnSecondary} onPress={() => toggle(false)}>
          <Text style={common.btnSecondaryText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={common.btnPrimary} onPress={handleSave}>
          <Text style={common.btnPrimaryText}>Salvar Bloqueio</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
