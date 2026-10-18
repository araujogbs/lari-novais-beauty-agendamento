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
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
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

  const handleSelectService = (service: ServiceItem) => {
    animateLayout();
    setSelectedService(service);
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
          {step === 1 || !selectedService
            ? 'Beleza com naturalidade indo até você'
            : `${selectedService.name} • R$ ${formatBRL(selectedService.price)}`}
        </Text>
      </View>

      {step === 1 && <ServiceStep services={services} loading={loadingServices} onSelect={handleSelectService} />}

      {step === 2 && selectedService && (
        <DetailsStep
          service={selectedService}
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
