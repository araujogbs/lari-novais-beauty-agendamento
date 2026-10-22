import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Calendar } from 'react-native-calendars';
import { SkeletonList } from '../../components/Skeleton';
import { START_TIME_INFO } from '../../constants';
import type { BookingForm } from '../../hooks/useBookingForm';
import { createAppointment, getAvailableSlots } from '../../services/appointments';
import { addBookingToken } from '../../services/myBookings';
import { common } from '../../styles/common';
import { THEME } from '../../theme';
import type { BookedSummary, Notify, OpenLightbox, ServiceItem } from '../../types';
import { brasiliaToUtcIso, formatLongDate, todayISO } from '../../utils/date';
import { getErrorMessage } from '../../utils/errors';
import { animateLayout } from '../../utils/layoutAnimation';
import { AddressSection } from './AddressSection';
import { BookingTicket } from './BookingTicket';
import { bookingStyles as styles } from './bookingStyles';
import { DescriptionSection } from './DescriptionSection';
import { PeopleSelector } from './PeopleSelector';

interface Props {
  services: ServiceItem[];
  form: BookingForm;
  notify: Notify;
  openLightbox: OpenLightbox;
  onBack: () => void;
  onBooked: (summary: BookedSummary) => void;
}

/** Etapa 2: dia, pessoas, horário, dados, descrição e confirmação. */
export function DetailsStep({ services, form, notify, openLightbox, onBack, onBooked }: Props) {
  const { selectedDate, selectedSlot, people } = form;
  const [submitting, setSubmitting] = useState(false);

  // Horários livres da combinação serviço + dia + pessoas. Enquanto a resposta da combinação
  // atual não chega, está carregando (e nunca mostra os horários de outro dia).
  const serviceIds = services.map((s) => s.id);
  const slotsKey = `${serviceIds.join(',')}|${selectedDate}|${people}`;
  const [slotsResult, setSlotsResult] = useState<{ key: string; slots: string[] } | null>(null);
  const loadingSlots = slotsResult?.key !== slotsKey;
  const availableSlots = slotsResult && !loadingSlots ? slotsResult.slots : [];

  useEffect(() => {
    let active = true;
    form.setSelectedSlot(null);
    getAvailableSlots(serviceIds, selectedDate, people)
      .then((slots) => active && setSlotsResult({ key: slotsKey, slots }))
      .catch(() => {
        if (!active) return;
        setSlotsResult({ key: slotsKey, slots: [] });
        notify('Erro', 'Falha ao procurar horários livres para esta data.');
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsKey]);

  const handleConfirm = async () => {
    if (!selectedSlot) {
      notify('Horário', 'Selecione um horário disponível.');
      return;
    }
    if (!form.clientName.trim() || form.clientPhone.replace(/\D/g, '').length < 10) {
      notify('Atenção', 'Preencha o seu nome e um WhatsApp válido.');
      return;
    }
    if (!form.description.trim()) {
      notify('Atenção', 'Descreva como você quer o serviço.');
      return;
    }

    try {
      setSubmitting(true);
      // O slot (horário de início) está em horário de Brasília;
      // a API recebe UTC e calcula o término somando a duração total (serviço x pessoas)
      const created = await createAppointment({
        clientName: form.clientName,
        clientPhone: form.clientPhone,
        clientAddress: [form.clientAddress.trim(), form.addressNumber.trim()].filter(Boolean).join(', '),
        cep: form.feeEstimate ? form.clientCep.replace(/\D/g, '') : undefined,
        description: form.description.trim(),
        serviceItemIds: serviceIds,
        startTime: brasiliaToUtcIso(selectedDate, selectedSlot),
        people,
        images: form.images,
      });

      if (created.data?.manageToken) await addBookingToken(created.data.manageToken);

      const summary: BookedSummary = {
        phone: form.clientPhone,
        service: services.map((s) => s.name).join(' + '),
        when: `${formatLongDate(selectedDate)} • início às ${selectedSlot}`,
        total: services.reduce((sum, s) => sum + s.price, 0) * people + form.travelFeeValue,
      };
      form.reset();
      onBooked(summary);
    } catch (error: any) {
      notify('Não foi possível agendar', getErrorMessage(error, 'Erro ao confirmar agendamento.'));
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={common.scrollContent} showsVerticalScrollIndicator={false}>
      <Text style={styles.sectionHeader}>1. Escolha o Dia</Text>
      <View style={common.calendarContainer}>
        <Calendar
          current={selectedDate}
          minDate={todayISO()}
          onDayPress={(day: any) => form.setSelectedDate(day.dateString)}
          markedDates={{
            [selectedDate]: {
              selected: true,
              selectedColor: THEME.rose,
              selectedTextColor: THEME.white,
            },
          }}
          theme={{
            backgroundColor: THEME.white,
            calendarBackground: THEME.white,
            textSectionTitleColor: THEME.textMuted,
            todayTextColor: THEME.roseDark,
            arrowColor: THEME.roseDark,
            textDayFontWeight: '400',
            textMonthFontWeight: '600',
            textDayHeaderFontWeight: '500',
          }}
        />
      </View>

      <Text style={styles.sectionHeader}>2. Para quantas pessoas?</Text>
      <PeopleSelector people={people} onChange={form.setPeople} />
      <Text style={styles.disclaimerText}>
        O valor do serviço e o tempo de atendimento são multiplicados pelo número de pessoas. O deslocamento é cobrado uma vez só.
      </Text>

      <Text style={styles.sectionHeader}>3. Horário de início</Text>
      <Text style={styles.disclaimerText}>{START_TIME_INFO}</Text>
      {loadingSlots ? (
        <SkeletonList height={44} />
      ) : availableSlots.length === 0 ? (
        <View style={common.emptyContainer}>
          <Ionicons name="calendar-clear-outline" size={22} color={THEME.textMuted} />
          <Text style={common.emptyText}>Nenhum horário livre nesta data.</Text>
        </View>
      ) : (
        <View style={styles.slotsGrid}>
          {availableSlots.map((slot) => {
            const isSelected = selectedSlot === slot;
            return (
              <TouchableOpacity
                key={slot}
                style={[common.slotBadge, isSelected && common.slotBadgeActive]}
                onPress={() => {
                  animateLayout();
                  form.setSelectedSlot(slot);
                }}
              >
                <Text style={[common.slotBadgeText, isSelected && common.slotBadgeTextActive]}>{slot}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionHeader}>4. Dados e Local</Text>
      <AddressSection form={form} />

      <Text style={styles.sectionHeader}>4. Como você quer o serviço</Text>
      <DescriptionSection form={form} openLightbox={openLightbox} />

      {selectedSlot && (
        <BookingTicket
          services={services}
          date={selectedDate}
          slot={selectedSlot}
          people={people}
          travelFee={form.travelFeeValue}
        />
      )}

      <Text style={styles.disclaimerText}>
        * O valor final pode sofrer acréscimo de taxa de deslocamento dependendo da região. Para garantir o horário, depois
        que a Lari confirmar o seu pedido você recebe o PIX do sinal.
      </Text>

      <View style={common.actionButtons}>
        <TouchableOpacity style={common.btnSecondary} onPress={onBack} disabled={submitting}>
          <Text style={common.btnSecondaryText}>Voltar</Text>
        </TouchableOpacity>

        <TouchableOpacity style={common.btnPrimary} onPress={handleConfirm} disabled={submitting}>
          {submitting ? <ActivityIndicator color={THEME.white} /> : <Text style={common.btnPrimaryText}>Confirmar</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
