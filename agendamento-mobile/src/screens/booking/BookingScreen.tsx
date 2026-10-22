import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stepper } from '../../components/Stepper';
import { useBookingForm } from '../../hooks/useBookingForm';
import api from '../../services/api';
import { getServices } from '../../services/appointments';
import { common } from '../../styles/common';
import type { BookedSummary, Notify, OpenLightbox, ServiceItem } from '../../types';
import { formatBRL } from '../../utils/format';
import { animateLayout } from '../../utils/layoutAnimation';
import { DetailsStep } from './DetailsStep';
import { ServiceStep } from './ServiceStep';

interface Props {
  notify: Notify;
  openLightbox: OpenLightbox;
  onBooked: (summary: BookedSummary) => void;
}

/** Fluxo da cliente: 1) escolhe o serviço, 2) dia, horário, dados e confirmação. */
export function BookingScreen({ notify, openLightbox, onBooked }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  // Na ordem da lista, não na ordem dos toques
  const selectedServices = services.filter((s) => selectedIds.includes(s.id));
  const form = useBookingForm(notify);

  useEffect(() => {
    (async () => {
      try {
        setLoadingServices(true);
        setServices(await getServices());
      } catch (error: any) {
        console.error('getServices falhou:', error.code, error.message, error.response?.status, `${api.defaults.baseURL}/services`);
        notify('Erro', 'Não foi possível carregar os serviços da API.');
      } finally {
        setLoadingServices(false);
      }
    })();
  }, [notify]);

  const handleToggleService = (service: ServiceItem) => {
    animateLayout();
    setSelectedIds((ids) => (ids.includes(service.id) ? ids.filter((id) => id !== service.id) : [...ids, service.id]));
  };

  const handleContinue = () => {
    if (!selectedServices.length) return;
    animateLayout();
    setStep(2);
  };

  const handleBack = () => {
    animateLayout();
    setStep(1);
  };

  return (
    <View style={{ flex: 1 }}>
      <Stepper step={step} />
      <View style={common.header}>
        <Text style={common.title}>{step === 1 ? 'Serviços & Atendimentos' : 'Selecione o Horário'}</Text>
        <Text style={common.subtitle}>
          {step === 1 || !selectedServices.length
            ? 'Beleza com naturalidade indo até você'
            : `${selectedServices.map((s) => s.name).join(' + ')} • R$ ${formatBRL(
                selectedServices.reduce((sum, s) => sum + s.price, 0),
              )}`}
        </Text>
      </View>

      {step === 1 && (
        <ServiceStep
          services={services}
          loading={loadingServices}
          selectedIds={selectedIds}
          onToggle={handleToggleService}
          onContinue={handleContinue}
        />
      )}

      {step === 2 && selectedServices.length > 0 && (
        <DetailsStep
          services={selectedServices}
          form={form}
          notify={notify}
          openLightbox={openLightbox}
          onBack={handleBack}
          onBooked={onBooked}
        />
      )}
    </View>
  );
}
