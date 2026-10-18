import { useState } from 'react';
import { Vibration } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MAX_IMAGES, MAX_IMAGE_BYTES } from '../constants';
import { estimateFee } from '../services/appointments';
import type { FeeEstimate, Notify } from '../types';
import { todayISO } from '../utils/date';
import { getErrorMessage } from '../utils/errors';
import { formatCep, formatPhone } from '../utils/format';

/** Estado do formulário de agendamento. Vive na tela de agendamento, então sobrevive ao "Voltar" entre as etapas. */
export function useBookingForm(notify: Notify) {
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null); // horário em que ela precisa estar pronta
  const [people, setPeople] = useState(1); // serviço para quantas pessoas (valor e duração multiplicam)

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientAddress, setClientAddress] = useState('');
  const [clientCep, setClientCep] = useState('');
  const [addressNumber, setAddressNumber] = useState('');
  const [feeEstimate, setFeeEstimate] = useState<FeeEstimate | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);

  const travelFeeValue = feeEstimate?.travelFee ?? 0;

  const handlePhoneChange = (text: string) => setClientPhone(formatPhone(text));

  const handleCepChange = async (text: string) => {
    const masked = formatCep(text);
    setClientCep(masked);
    setFeeError(null);
    const digits = masked.replace(/\D/g, '');
    if (digits.length < 8) {
      setFeeEstimate(null);
      return;
    }
    try {
      setFeeLoading(true);
      const data = await estimateFee(digits);
      setFeeEstimate(data);
      const parts = [data.street, data.neighborhood].filter(Boolean);
      if (parts.length) setClientAddress(parts.join(', '));
    } catch (error: any) {
      setFeeEstimate(null);
      setFeeError(getErrorMessage(error, 'Não foi possível calcular o deslocamento para este CEP.'));
    } finally {
      setFeeLoading(false);
    }
  };

  const toggleMoodTag = (tag: string) => {
    Vibration.vibrate(10);
    setDescription((prev) => {
      const parts = prev.split(',').map((t) => t.trim()).filter(Boolean);
      const next = parts.includes(tag) ? parts.filter((t) => t !== tag) : [...parts, tag];
      return next.join(', ');
    });
  };

  const pickImages = async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      notify('Atenção', `Você pode anexar até ${MAX_IMAGES} imagens.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7, // reduz o tamanho do upload
    });
    if (result.canceled) return;

    const tooBig = result.assets.some((a) => (a.fileSize ?? 0) > MAX_IMAGE_BYTES);
    if (tooBig) {
      notify('Atenção', 'Cada imagem deve ter até 5 MB.');
    }
    const valid = result.assets.filter((a) => (a.fileSize ?? 0) <= MAX_IMAGE_BYTES);
    setImages((prev) => [...prev, ...valid].slice(0, MAX_IMAGES));
  };

  const removeImage = (index: number) => setImages((prev) => prev.filter((_, idx) => idx !== index));

  /** Limpa os dados da cliente depois de agendar (a data escolhida é mantida). */
  const reset = () => {
    setSelectedSlot(null);
    setPeople(1);
    setClientName('');
    setClientPhone('');
    setClientAddress('');
    setClientCep('');
    setAddressNumber('');
    setFeeEstimate(null);
    setFeeError(null);
    setDescription('');
    setImages([]);
  };

  return {
    selectedDate,
    setSelectedDate,
    selectedSlot,
    setSelectedSlot,
    people,
    setPeople,
    clientName,
    setClientName,
    clientPhone,
    handlePhoneChange,
    clientAddress,
    setClientAddress,
    clientCep,
    handleCepChange,
    addressNumber,
    setAddressNumber,
    feeEstimate,
    feeLoading,
    feeError,
    travelFeeValue,
    description,
    setDescription,
    toggleMoodTag,
    images,
    pickImages,
    removeImage,
    reset,
  };
}

export type BookingForm = ReturnType<typeof useBookingForm>;
