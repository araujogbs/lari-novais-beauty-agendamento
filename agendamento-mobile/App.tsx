import React, { useEffect, useRef, useState } from 'react';
import { useFonts, CormorantGaramond_400Regular, CormorantGaramond_400Regular_Italic } from '@expo-google-fonts/cormorant-garamond';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  TextInput,
  ScrollView,
  ImageBackground,
  Image,
  Platform,
  Linking,
  Animated,
  LayoutAnimation,
  Modal,
  Vibration,
  UIManager,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import api from './src/services/api';
import { authService } from './src/services/auth';

// Configuração do calendário em Português
LocaleConfig.locales['pt-br'] = {
  monthNames: ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje'
};
LocaleConfig.defaultLocale = 'pt-br';

// Paleta de Cores
const THEME = {
  white: '#ffffff',
  cream: '#faf9f8',
  rose: '#c4a08a',
  roseLight: '#e8d5c8',
  roseDark: '#a07e68',
  text: '#2c2c2c',
  textLight: '#6b6b6b',
  textMuted: '#9b9b9b',
  border: 'rgba(196, 160, 138, 0.25)',
};

interface ServiceItem {
  id: number;
  name: string;
  durationMinutes: number;
  price: number;
}

interface AppointmentItem {
  id: number;
  clientName: string;
  clientPhone: string;
  startTime: string;
  endTime: string;
  status: string;
  serviceItem?: ServiceItem;
  clientAddress?: string;
  travelFee?: number | null;
  distanceKm?: number | null;
  description?: string;
  referenceImages?: string[];
}

interface MyAppointment {
  id: number;
  serviceName: string;
  price: number;
  startTime: string;
  endTime: string;
  clientAddress?: string;
  travelFee?: number | null;
  distanceKm?: number | null;
  status: string;
}

interface FeeEstimate {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  distanceKm: number;
  travelFee: number;
}

const formatBRL = (v: number) => v.toFixed(2).replace('.', ',');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const animateLayout = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

const MOOD_TAGS = ['Pele Glow', 'Make Matte', 'Olho Marcante', 'Natural / Clean', 'Coque Clássico', 'Ondas / Cachos'];

type LightboxSource = { uri: string; headers?: Record<string, string> };

// Bloco placeholder com opacidade pulsante
function SkeletonBlock({ height = 64, style }: { height?: number; style?: any }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ height, borderRadius: 12, backgroundColor: THEME.roseLight, opacity }, style]} />;
}

function SkeletonList({ height = 64 }: { height?: number }) {
  return (
    <View style={{ paddingHorizontal: 16, gap: 12, marginVertical: 14 }}>
      {[0, 1, 2].map((i) => (
        <SkeletonBlock key={i} height={height} />
      ))}
    </View>
  );
}

// Indicador de etapas com linha que preenche
function Stepper({ step }: { step: 1 | 2 }) {
  const fill = useRef(new Animated.Value(step === 2 ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: step === 2 ? 1 : 0, duration: 350, useNativeDriver: false }).start();
  }, [step, fill]);
  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.stepper}>
      <View style={styles.stepItem}>
        <View style={[styles.stepDot, styles.stepDotActive]}>
          {step === 2 ? <Ionicons name="checkmark" size={14} color={THEME.white} /> : <Text style={styles.stepDotText}>1</Text>}
        </View>
        <Text style={[styles.stepLabel, styles.stepLabelActive]}>Serviço</Text>
      </View>
      <View style={styles.stepLine}>
        <Animated.View style={[styles.stepLineFill, { width }]} />
      </View>
      <View style={styles.stepItem}>
        <View style={[styles.stepDot, step === 2 && styles.stepDotActive]}>
          <Text style={[styles.stepDotText, step !== 2 && { color: THEME.textMuted }]}>2</Text>
        </View>
        <Text style={[styles.stepLabel, step === 2 && styles.stepLabelActive]}>Data & Detalhes</Text>
      </View>
    </View>
  );
}

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export default function App() {
  // 1. Carregar a fonte (mantenha como você já fez)
  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
  });

  // Atualize esta linha:
  const [viewMode, setViewMode] = useState<'welcome' | 'client' | 'adminLogin' | 'admin' | 'myAppointments' | 'success'>('welcome');
  const [booked, setBooked] = useState<{ phone: string; service: string; when: string; total: number } | null>(null);

  // Estados de autenticação
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [step, setStep] = useState<1 | 2>(1);

  // Verifica se o usuário está autenticado ao mudar para o modo admin
  useEffect(() => {
    if (viewMode === 'admin') {
      checkAuthAndLoadAppointments();
    }
  }, [viewMode]);

  const checkAuthAndLoadAppointments = async () => {
    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
      setViewMode('adminLogin');
      return;
    }
    fetchAdminAppointments(adminDate);
  };

  // Estados dos Serviços
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  // Estados da Marcação
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  
  // Dados do Cliente
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

  // Estados de "Meus Agendamentos" (cliente)
  const [myPhone, setMyPhone] = useState('');
  const [myAppointments, setMyAppointments] = useState<MyAppointment[]>([]);
  const [myLoading, setMyLoading] = useState(false);
  const [mySearched, setMySearched] = useState(false);
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);

  // Estados da Administração
  const [adminToken, setAdminToken] = useState<string | null>(null); // para carregar as fotos (rota protegida)
  const [adminDate, setAdminDate] = useState(todayStr);
  const [appointmentsList, setAppointmentsList] = useState<AppointmentItem[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // Estados do bloqueio de agenda
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [blockMode, setBlockMode] = useState<'day' | 'range'>('day');
  const [blockStart, setBlockStart] = useState('09:00');
  const [blockEnd, setBlockEnd] = useState('15:00');
  const [blockReason, setBlockReason] = useState('Folga');

  // Aviso na tela (Alert.alert não funciona no navegador, então usamos um banner em todas as plataformas)
  const [toast, setToast] = useState<{ title: string; message: string; type: 'success' | 'error' | 'warn' } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = (title: string, message: string, type?: 'success' | 'error' | 'warn') => {
    const kind = type ?? (/sucesso|confirmado/i.test(title) ? 'success' : /atenção|horário/i.test(title) ? 'warn' : 'error');
    setToast({ title, message, type: kind });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };

  // Estados visuais
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [lightbox, setLightbox] = useState<LightboxSource | null>(null);

  const toggleMoodTag = (tag: string) => {
    Vibration.vibrate(10);
    setDescription((prev) => {
      const parts = prev.split(',').map((t) => t.trim()).filter(Boolean);
      const next = parts.includes(tag) ? parts.filter((t) => t !== tag) : [...parts, tag];
      return next.join(', ');
    });
  };

  const formatEstimatedRange = () => {
    if (!selectedSlot || !selectedService) return '';
    const [h, m] = selectedSlot.split(':').map(Number);
    const total = h * 60 + m + selectedService.durationMinutes;
    const end = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    return `${selectedSlot} às ${end}`;
  };
  

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await api.get<ServiceItem[]>('/services');
      setServices(response.data);
    } catch (error: any) {
      console.error('fetchServices falhou:', error.code, error.message, error.response?.status, `${api.defaults.baseURL}/services`);
      notify('Erro', 'Não foi possível carregar os serviços da API.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSlots = async (serviceId: number, dateStr: string) => {
    try {
      setLoadingSlots(true);
      setSelectedSlot(null);
      const response = await api.get<string[]>('/appointments/available-slots', {
        params: { serviceId, date: dateStr },
      });
      setAvailableSlots(response.data);
    } catch (error) {
      notify('Erro', 'Falha ao procurar horários livres para esta data.');
    } finally {
      setLoadingSlots(false);
    }
  };

  const fetchAdminAppointments = async (dateStr: string) => {
    try {
      setLoadingAdmin(true);
      setAdminToken(await authService.getToken());
      const response = await api.get<AppointmentItem[]>('/appointments', {
        params: { date: dateStr },
      });
      setAppointmentsList(response.data);
    } catch (error: any) {
      console.error('Erro ao buscar agendamentos:', error.response?.status, error.response?.data);
      if (error.response?.status === 401 || error.response?.status === 403) {
        // Token inválido ou expirado, fazer logout e ir para login
        await authService.removeToken();
        setViewMode('adminLogin');
        notify('Sessão expirada', 'Por favor, faça login novamente.');
      } else {
        notify('Erro', 'Não foi possível carregar os agendamentos.');
      }
    } finally {
      setLoadingAdmin(false);
    }
  };

  const getErrorMessage = (error: any, fallback: string) => {
    if (error.response) return error.response.data?.message || fallback;
    if (error.request) return `Sem conexão com o servidor (${api.defaults.baseURL}). Verifique o Wi-Fi e tente novamente.`;
    return fallback;
  };

  // Área da maquiadora fica escondida: abre com toque longo no título da tela inicial
  const openAdminArea = async () => {
    const isAuthenticated = await authService.isAuthenticated();
    setViewMode(isAuthenticated ? 'admin' : 'adminLogin');
  };

  const isValidTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

  const handleBlockDay = async () => {
    const payload: { date: string; reason?: string; startTime?: string; endTime?: string } = {
      date: adminDate,
      reason: blockReason.trim() || undefined,
    };

    if (blockMode === 'range') {
      if (!isValidTime(blockStart) || !isValidTime(blockEnd)) {
        notify('Atenção', 'Use o formato HH:mm (ex: 09:00).');
        return;
      }
      if (blockStart >= blockEnd) {
        notify('Atenção', 'O início deve ser anterior ao fim.');
        return;
      }
      if (blockStart < '09:00' || blockEnd > '18:00') {
        notify('Atenção', 'O intervalo deve estar entre 09:00 e 18:00.');
        return;
      }
      payload.startTime = `${blockStart}:00`;
      payload.endTime = `${blockEnd}:00`;
    }

    try {
      await api.post('/appointments/block-slot', payload);
      notify('Sucesso', blockMode === 'day' ? 'Dia bloqueado com sucesso!' : 'Intervalo bloqueado com sucesso!');
      setShowBlockForm(false);
      fetchAdminAppointments(adminDate);
    } catch (error: any) {
      console.error('Erro ao bloquear agenda:', error);
      notify('Erro', getErrorMessage(error, 'Falha ao bloquear a agenda.'));
    }
  };

  const handleSelectService = (service: ServiceItem) => {
    animateLayout();
    setSelectedService(service);
    setStep(2);
    fetchAvailableSlots(service.id, selectedDate);
  };

  const formatPhone = (text: string) => {
    const raw = text.replace(/\D/g, '');
    let formatted = raw;
    if (raw.length > 2) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    }
    if (raw.length > 7) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
    }
    return formatted;
  };

  const handlePhoneChange = (text: string) => setClientPhone(formatPhone(text));

  const formatCep = (text: string) => {
    const raw = text.replace(/\D/g, '').slice(0, 8);
    return raw.length > 5 ? `${raw.slice(0, 5)}-${raw.slice(5)}` : raw;
  };

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
      const { data } = await api.get<FeeEstimate>('/appointments/estimate-fee', { params: { cep: digits } });
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

  const travelFeeValue = feeEstimate?.travelFee ?? 0;

  // Atalhos do painel admin
  const openWhatsApp = (item: AppointmentItem) => {
    let phone = item.clientPhone.replace(/\D/g, '');
    if (phone.length <= 11) phone = `55${phone}`; // sem DDI
    const text = `Olá ${item.clientName}, tudo bem? Passando para confirmar seu atendimento de ${item.serviceItem?.name}.`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`).catch(() =>
      notify('Erro', 'Não foi possível abrir o WhatsApp.'),
    );
  };

  const openMap = (address: string) => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`).catch(() =>
      notify('Erro', 'Não foi possível abrir o mapa.'),
    );
  };

  // Meus Agendamentos
  const handleSearchMyAppointments = async (phoneOverride?: string) => {
    const phone = typeof phoneOverride === 'string' ? phoneOverride : myPhone;
    if (phone.replace(/\D/g, '').length < 10) {
      notify('Atenção', 'Informe um WhatsApp válido.');
      return;
    }
    try {
      setMyLoading(true);
      setConfirmCancelId(null);
      const response = await api.get<MyAppointment[]>('/appointments/my-appointments', {
        params: { phone },
      });
      setMyAppointments(response.data);
      setMySearched(true);
    } catch (error: any) {
      notify('Erro', getErrorMessage(error, 'Não foi possível buscar seus agendamentos.'));
    } finally {
      setMyLoading(false);
    }
  };

  const goToMyAppointments = () => {
    const phone = booked?.phone ?? '';
    setMyPhone(phone);
    setMyAppointments([]);
    setMySearched(false);
    setConfirmCancelId(null);
    setViewMode('myAppointments');
    handleSearchMyAppointments(phone);
  };

  useEffect(() => {
    if (viewMode !== 'success') return;
    const t = setTimeout(goToMyAppointments, 6000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const handleClientCancel = async (id: number) => {
    try {
      await api.post(`/appointments/${id}/client-cancel`, { phone: myPhone });
      notify('Sucesso', 'Agendamento cancelado com sucesso.', 'success');
      setConfirmCancelId(null);
      handleSearchMyAppointments();
    } catch (error: any) {
      setConfirmCancelId(null);
      notify('Não foi possível cancelar', getErrorMessage(error, 'Falha ao cancelar o agendamento.'), 'error');
    }
  };

  const handlePickImages = async () => {
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

  const handleConfirmAppointment = async () => {
    if (!selectedSlot) {
      notify('Horário', 'Selecione um horário disponível.');
      return;
    }
    if (!clientName.trim() || clientPhone.replace(/\D/g, '').length < 10) {
      notify('Atenção', 'Preencha o seu nome e um WhatsApp válido.');
      return;
    }

    if (!description.trim()) {
      notify('Atenção', 'Descreva como você quer o serviço.');
      return;
    }

    try {
      setLoading(true);
      // O slot está em horário de Brasília (UTC-3, sem horário de verão); a API recebe UTC
      const startTimeIso = new Date(`${selectedDate}T${selectedSlot}:00-03:00`).toISOString();

      // multipart/form-data: campos de texto + fotos de referência
      const form = new FormData();
      form.append('clientName', clientName);
      form.append('clientPhone', clientPhone);
      const fullAddress = [clientAddress.trim(), addressNumber.trim()].filter(Boolean).join(', ');
      form.append('clientAddress', fullAddress);
      if (feeEstimate) form.append('cep', clientCep.replace(/\D/g, ''));
      form.append('description', description.trim());
      form.append('serviceItemId', String(selectedService?.id));
      form.append('startTime', startTimeIso);
      images.forEach((img, i) => {
        if (Platform.OS === 'web' && img.file) {
          form.append('images', img.file);
        } else {
          form.append('images', {
            uri: img.uri,
            name: img.fileName ?? `referencia-${i + 1}.jpg`,
            type: img.mimeType ?? 'image/jpeg',
          } as any);
        }
      });

      await api.post('/appointments', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        transformRequest: (data) => data, // evita o axios serializar o FormData
      });

      const whenLabel = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      setBooked({
        phone: clientPhone,
        service: selectedService?.name ?? 'Serviço',
        when: `${whenLabel} às ${selectedSlot}`,
        total: (selectedService?.price ?? 0) + travelFeeValue,
      });

      setStep(1);
      setSelectedService(null);
      setSelectedSlot(null);
      setClientName('');
      setClientPhone('');
      setClientAddress('');
      setClientCep('');
      setAddressNumber('');
      setFeeEstimate(null);
      setFeeError(null);
      setDescription('');
      setImages([]);
      setViewMode('success');
    } catch (error: any) {
      notify('Não foi possível agendar', getErrorMessage(error, 'Erro ao confirmar agendamento.'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (id: number) => {
    try {
      // A API espera uma string JSON (com aspas); o axios enviaria Cancelled cru e dava 400
      await api.patch(`/appointments/${id}/status`, JSON.stringify('Cancelled'), {
        headers: { 'Content-Type': 'application/json' },
      });
      notify('Sucesso', 'Marcação desmarcada com sucesso.');
      fetchAdminAppointments(adminDate);
    } catch (error) {
      notify('Erro', 'Falha ao desmarcar. Tente novamente.');
    }
  };

  const handleAdminLogin = async () => {
    if (!adminUsername.trim() || !adminPassword) {
      notify('Atenção', 'Informe usuário e senha.');
      return;
    }
    setLoading(true);
    try {
      await authService.login(adminUsername.trim(), adminPassword);
      setAdminUsername('');
      setAdminPassword('');
      setViewMode('admin'); // o useEffect carrega os agendamentos
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 401) {
        notify('Acesso negado', 'Usuário ou senha incorretos.');
      } else if (status === 503) {
        notify('Login indisponível', 'O servidor ainda não tem o usuário administrador configurado.');
      } else {
        notify('Erro ao entrar', getErrorMessage(error, 'Não foi possível fazer login.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />
      
      {/* Background Elegante e Discreto */}
      <ImageBackground 
        source={require('./assets/fundo.jpg')} 
        style={styles.backgroundWrapper}
        imageStyle={styles.backgroundImage}
      >
        <View style={styles.overlay}>
          {toast && (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => setToast(null)}
              style={[
                styles.toast,
                toast.type === 'success' && styles.toastSuccess,
                toast.type === 'error' && styles.toastError,
                toast.type === 'warn' && styles.toastWarn,
              ]}
            >
              <Text style={styles.toastTitle}>{toast.title}</Text>
              {!!toast.message && <Text style={styles.toastMessage}>{toast.message}</Text>}
            </TouchableOpacity>
          )}
          {/* Brand Header */}
          <View style={styles.brandBar}>
            {viewMode !== 'welcome' && (
              <TouchableOpacity 
                style={{ position: 'absolute', left: 20, top: 48 }}
                onPress={() => setViewMode('welcome')}
              >
                <Ionicons name="home-outline" size={22} color={THEME.textLight} />
              </TouchableOpacity>
            )}
            <Text style={styles.brandTitle}>
              Lari Novais <Text style={styles.brandSubtitle}>Beauty</Text>
            </Text>
            <Text style={styles.brandTagline}>Atendimento a Domicílio</Text>
          </View>

          {/* Navigation Pills (Só aparece se NÃO estiver na home) */}
          {viewMode !== 'welcome' && (
            <View style={styles.topNav}>
              <TouchableOpacity
                style={[styles.navBtn, viewMode === 'client' && styles.navBtnActive]}
                onPress={() => setViewMode('client')}
              >
                <Ionicons name="sparkles-outline" size={14} color={viewMode === 'client' ? THEME.white : THEME.textLight} />
                <Text style={[styles.navText, viewMode === 'client' && styles.navTextActive]}>Agendar Horário</Text>
              </TouchableOpacity>

              {viewMode === 'admin' && (
                <TouchableOpacity
                  style={[styles.navBtn, viewMode === 'admin' && styles.navBtnActive]}
                  onPress={() => {
                    setViewMode('admin');
                  }}
                >
                  <Ionicons name="calendar-outline" size={14} color={viewMode === 'admin' ? THEME.white : THEME.textLight} />
                  <Text style={[styles.navText, viewMode === 'admin' && styles.navTextActive]}>Painel Ateliê</Text>
                </TouchableOpacity>
              )}

              {viewMode === 'admin' && (
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={async () => {
                    await authService.removeToken();
                    setViewMode('welcome');
                  }}
                >
                  <Ionicons name="log-out-outline" size={14} color={THEME.textLight} />
                  <Text style={[styles.navText, { color: THEME.textLight }]}>Sair</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

{/* --- TELA DE LOGIN ADMIN --- */}
          {viewMode === 'adminLogin' && (
            <View style={{ flex: 1, padding: 24 }}>
              <Text style={styles.welcomeTitle}>
                Lari Novais <Text style={styles.brandSubtitle}>Beauty</Text>
              </Text>
              <Text style={styles.welcomeTagline}>Painel Ateliê</Text>

              <View style={styles.formCard}>
                <Text style={styles.inputLabel}>Usuário</Text>
                <TextInput
                  style={styles.textInput}
                  value={adminUsername}
                  onChangeText={setAdminUsername}
                  placeholder="Usuário"
                  placeholderTextColor={THEME.textMuted}
                  autoCapitalize="none"
                />

                <Text style={[styles.inputLabel, { marginTop: 12 }]}>Senha</Text>
                <TextInput
                  style={styles.textInput}
                  value={adminPassword}
                  onChangeText={setAdminPassword}
                  placeholder="Senha"
                  placeholderTextColor={THEME.textMuted}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={handleAdminLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color={THEME.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Entrar</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* --- TELA INICIAL (WELCOME) --- */}
          {viewMode === 'welcome' && (
            <View style={styles.welcomeContainer}>
              <View style={styles.welcomeContent}>
                {/* Ícone decorativo de estrelinhas/brilho */}
                
                
                <Pressable onLongPress={openAdminArea} delayLongPress={4000}>
                  <Text style={styles.welcomeTitle}>
                    Lari Novais <Text style={styles.brandSubtitle}>Beauty</Text>
                  </Text>
                </Pressable>
                <Text style={styles.welcomeTagline}>Beleza com Naturalidade, Técnica e Identidade</Text>
                <Text style={styles.welcomeDesc}>
                  Atendimento exclusivo e personalizado a domicílio para casamentos, formaturas e eventos sociais.
                </Text>
              </View>

              <View style={styles.welcomeActions}>
                <TouchableOpacity
                  style={styles.welcomeBtnPrimary}
                  onPress={() => setViewMode('client')}
                >
                  <Ionicons name="sparkles" size={18} color={THEME.white} />
                  <Text style={styles.welcomeBtnPrimaryText}>Agendar Meu Horário</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.welcomeBtnOutline}
                  onPress={() => {
                    setMySearched(false);
                    setMyAppointments([]);
                    setViewMode('myAppointments');
                  }}
                >
                  <Ionicons name="calendar-outline" size={18} color={THEME.roseDark} />
                  <Text style={styles.welcomeBtnOutlineText}>Meus Agendamentos</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* --- AGENDAMENTO CONCLUÍDO --- */}
          {viewMode === 'success' && booked && (
            <View style={styles.successWrap}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={44} color={THEME.white} />
              </View>
              <Text style={styles.successTitle}>Agendamento concluído!</Text>
              <Text style={styles.successSub}>Você receberá os detalhes via WhatsApp.</Text>
              <View style={styles.successCard}>
                <Text style={styles.ticketService}>{booked.service}</Text>
                <Text style={styles.ticketDate}>{booked.when}</Text>
                <View style={styles.ticketDivider} />
                <Text style={styles.ticketLabel}>Valor total</Text>
                <Text style={styles.ticketPrice}>R$ {formatBRL(booked.total)}</Text>
              </View>
              <TouchableOpacity style={[styles.btnPrimary, { flex: 0, alignSelf: 'stretch' }]} onPress={goToMyAppointments}>
                <Text style={styles.btnPrimaryText}>Ver meus agendamentos</Text>
              </TouchableOpacity>
              <Text style={styles.successHint}>Você será levada para seus agendamentos em instantes…</Text>
            </View>
          )}

          {/* --- MEUS AGENDAMENTOS (CLIENTE) --- */}
          {viewMode === 'myAppointments' && (
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <Text style={styles.title}>Meus Agendamentos</Text>
                <Text style={styles.subtitle}>Consulte ou cancele usando seu WhatsApp</Text>
              </View>

              <View style={styles.formCard}>
                <Text style={styles.inputLabel}>WhatsApp</Text>
                <TextInput
                  style={styles.textInput}
                  value={myPhone}
                  onChangeText={(t) => setMyPhone(formatPhone(t))}
                  placeholder="(11) 99999-9999"
                  placeholderTextColor={THEME.textMuted}
                  keyboardType="numeric"
                  maxLength={15}
                />
              </View>

              <TouchableOpacity
                style={[styles.btnPrimary, { flex: 0, marginTop: 16 }]}
                onPress={() => handleSearchMyAppointments()}
                disabled={myLoading}
              >
                {myLoading ? (
                  <ActivityIndicator color={THEME.white} />
                ) : (
                  <Text style={styles.btnPrimaryText}>Buscar</Text>
                )}
              </TouchableOpacity>

              {mySearched && myAppointments.length === 0 && (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Nenhum agendamento futuro para este número.</Text>
                </View>
              )}

              <View style={{ marginTop: 16 }}>
                {myAppointments.map((appt) => {
                  const start = new Date(appt.startTime);
                  const dateStr = start.toLocaleDateString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    weekday: 'short',
                    day: '2-digit',
                    month: '2-digit',
                  });
                  const timeStr = start.toLocaleTimeString('pt-BR', {
                    timeZone: 'America/Sao_Paulo',
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  return (
                    <View key={appt.id} style={styles.adminCard}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.adminClientTitle}>{appt.serviceName}</Text>
                        <Text style={styles.adminSubText}>
                          {dateStr} • {timeStr} • R$ {formatBRL(appt.price + (appt.travelFee ?? 0))}
                        </Text>
                        {appt.travelFee ? (
                          <Text style={styles.adminPhoneText}>
                            Inclui deslocamento ({appt.distanceKm?.toFixed(1)} km): R$ {formatBRL(appt.travelFee)}
                          </Text>
                        ) : null}
                        {appt.clientAddress ? (
                          <Text style={styles.adminPhoneText}>Local: {appt.clientAddress}</Text>
                        ) : null}
                      </View>

                      {confirmCancelId === appt.id ? (
                        <View style={{ gap: 6 }}>
                          <TouchableOpacity style={styles.cancelAction} onPress={() => handleClientCancel(appt.id)}>
                            <Text style={styles.cancelActionText}>Confirmar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.cancelAction, { backgroundColor: THEME.cream }]}
                            onPress={() => setConfirmCancelId(null)}
                          >
                            <Text style={[styles.cancelActionText, { color: THEME.textLight }]}>Voltar</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.cancelAction} onPress={() => setConfirmCancelId(appt.id)}>
                          <Text style={styles.cancelActionText}>Cancelar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* --- FLUXO CLIENTE --- */}
          {viewMode === 'client' && (
            <View style={{ flex: 1 }}>
              <Stepper step={step} />
              <View style={styles.header}>
                <Text style={styles.title}>
                  {step === 1 ? 'Serviços & Atendimentos' : 'Selecione o Horário'}
                </Text>
                <Text style={styles.subtitle}>
                  {step === 1
                    ? 'Beleza com naturalidade indo até você'
                    : `${selectedService?.name} • R$ ${selectedService?.price.toFixed(2).replace('.', ',')}`}
                </Text>
              </View>

              {step === 1 && (
                loading ? (
                  <SkeletonList height={72} />
                ) : (
                  <FlatList
                    data={services}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.serviceCard}
                        activeOpacity={0.85}
                        onPress={() => handleSelectService(item)}
                      >
                        <View style={styles.serviceInfo}>
                          <Text style={styles.serviceTitle}>{item.name}</Text>
                          <View style={styles.durationRow}>
                            <Ionicons name="time-outline" size={14} color={THEME.textMuted} />
                            <Text style={styles.durationText}>{item.durationMinutes} minutos</Text>
                          </View>
                        </View>
                        <View style={styles.priceContainer}>
                          <Text style={styles.priceText}>R$ {item.price.toFixed(2).replace('.', ',')}</Text>
                          <Ionicons name="chevron-forward" size={16} color={THEME.roseDark} />
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )
              )}

              {step === 2 && (
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                  <Text style={styles.sectionHeader}>1. Escolha o Dia</Text>
                  <View style={styles.calendarContainer}>
                    <Calendar
                      current={selectedDate}
                      minDate={todayStr}
                      onDayPress={(day: any) => {
                        setSelectedDate(day.dateString);
                        if (selectedService) {
                          fetchAvailableSlots(selectedService.id, day.dateString);
                        }
                      }}
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

                  <Text style={styles.sectionHeader}>2. Horários Livres</Text>
                  {loadingSlots ? (
                    <SkeletonList height={44} />
                  ) : availableSlots.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Ionicons name="calendar-clear-outline" size={22} color={THEME.textMuted} />
                      <Text style={styles.emptyText}>Nenhum horário livre nesta data.</Text>
                    </View>
                  ) : (
                    <View style={styles.slotsGrid}>
                      {availableSlots.map((slot) => {
                        const isSelected = selectedSlot === slot;
                        return (
                          <TouchableOpacity
                            key={slot}
                            style={[styles.slotBadge, isSelected && styles.slotBadgeActive]}
                            onPress={() => {
                              animateLayout();
                              setSelectedSlot(slot);
                            }}
                          >
                            <Text style={[styles.slotBadgeText, isSelected && styles.slotBadgeTextActive]}>
                              {slot}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  <Text style={styles.sectionHeader}>3. Dados e Local</Text>
                  <View style={styles.formCard}>
                    <Text style={styles.inputLabel}>Seu Nome</Text>
                    <TextInput
                      style={styles.textInput}
                      value={clientName}
                      onChangeText={setClientName}
                      placeholder="Nome completo"
                      placeholderTextColor={THEME.textMuted}
                    />

                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>WhatsApp</Text>
                    <TextInput
                      style={styles.textInput}
                      value={clientPhone}
                      onChangeText={handlePhoneChange}
                      placeholder="(11) 99999-9999"
                      placeholderTextColor={THEME.textMuted}
                      keyboardType="numeric"
                      maxLength={15}
                    />

                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>CEP</Text>
                    <TextInput
                      style={styles.textInput}
                      value={clientCep}
                      onChangeText={handleCepChange}
                      placeholder="00000-000"
                      placeholderTextColor={THEME.textMuted}
                      keyboardType="numeric"
                      maxLength={9}
                    />
                    {feeLoading ? (
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
                    ) : feeError ? (
                      <Text style={styles.feeErrorText}>{feeError}</Text>
                    ) : null}

                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>Endereço do Atendimento</Text>
                    <TextInput
                      style={[styles.textInput, { height: 65, textAlignVertical: 'top' }]}
                      value={clientAddress}
                      onChangeText={setClientAddress}
                      placeholder="Rua, Bairro"
                      placeholderTextColor={THEME.textMuted}
                      multiline
                    />

                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>Número e Complemento</Text>
                    <TextInput
                      style={styles.textInput}
                      value={addressNumber}
                      onChangeText={setAddressNumber}
                      placeholder="Ex.: 123, apto 45"
                      placeholderTextColor={THEME.textMuted}
                    />
                  </View>

                  <Text style={styles.sectionHeader}>4. Como você quer o serviço</Text>
                  <View style={styles.formCard}>
                    <Text style={styles.inputLabel}>Descrição *</Text>
                    <View style={styles.moodRow}>
                      {MOOD_TAGS.map((tag) => {
                        const active = description.split(',').map((t) => t.trim()).includes(tag);
                        return (
                          <TouchableOpacity
                            key={tag}
                            style={[styles.moodChip, active && styles.moodChipActive]}
                            onPress={() => toggleMoodTag(tag)}
                          >
                            <Text style={[styles.moodChipText, active && styles.moodChipTextActive]}>{tag}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    <TextInput
                      style={[styles.textInput, { height: 100, textAlignVertical: 'top' }]}
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Ex: make leve e natural, pele iluminada, olhos em tons de marrom..."
                      placeholderTextColor={THEME.textMuted}
                      multiline
                      maxLength={1000}
                    />

                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>
                      Imagens de referência (opcional) · {images.length}/{MAX_IMAGES}
                    </Text>
                    <View style={styles.imagesRow}>
                      {images.map((img, i) => (
                        <View key={img.uri} style={styles.thumbWrapper}>
                          <TouchableOpacity activeOpacity={0.85} onPress={() => setLightbox({ uri: img.uri })}>
                            <Image source={{ uri: img.uri }} style={styles.thumb} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.thumbRemove}
                            onPress={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                          >
                            <Ionicons name="close" size={14} color={THEME.white} />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {images.length < MAX_IMAGES && (
                        <TouchableOpacity style={styles.addImageBtn} onPress={handlePickImages}>
                          <Ionicons name="image-outline" size={22} color={THEME.roseDark} />
                          <Text style={styles.addImageText}>Adicionar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {selectedSlot && selectedService && (
                    <View style={styles.ticket}>
                      <View style={styles.ticketHead}>
                        <Ionicons name="sparkles" size={18} color={THEME.roseDark} />
                        <Text style={styles.ticketKicker}>Seu convite</Text>
                        <Ionicons name="sparkles" size={18} color={THEME.roseDark} />
                      </View>
                      <Text style={styles.ticketService}>{selectedService.name}</Text>
                      <Text style={styles.ticketDate}>
                        {new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        })}
                      </Text>
                      <View style={styles.ticketDivider} />
                      <View style={styles.ticketFooter}>
                        <View>
                          <Text style={styles.ticketLabel}>Horário estimado</Text>
                          <Text style={styles.ticketValue}>{formatEstimatedRange()}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.ticketLabel}>{travelFeeValue > 0 ? 'Valor total' : 'Valor'}</Text>
                          <Text style={styles.ticketPrice}>R$ {formatBRL(selectedService.price + travelFeeValue)}</Text>
                          {travelFeeValue > 0 ? (
                            <Text style={styles.ticketLabel}>
                              Serviço R$ {formatBRL(selectedService.price)} + deslocamento R$ {formatBRL(travelFeeValue)}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  )}

                  <Text style={styles.disclaimerText}>
                    * O valor final pode sofrer acréscimo de taxa de deslocamento dependendo da região.
                  </Text>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.btnSecondary}
                      onPress={() => {
                        animateLayout();
                        setStep(1);
                      }}
                      disabled={loading}
                    >
                      <Text style={styles.btnSecondaryText}>Voltar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.btnPrimary}
                      onPress={handleConfirmAppointment}
                      disabled={loading}
                    >
                      {loading ? (
                        <ActivityIndicator color={THEME.white} />
                      ) : (
                        <Text style={styles.btnPrimaryText}>Confirmar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </View>
          )}

          {/* --- FLUXO ADMIN --- */}
          {viewMode === 'admin' && (
            <View style={{ flex: 1 }}>
              <View style={styles.header}>
                <Text style={styles.title}>Painel de Atendimentos</Text>
                <Text style={styles.subtitle}>Sua gestão de agenda a domicílio</Text>
              </View>

              <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                {!showBlockForm ? (
                  <TouchableOpacity style={styles.btnPrimary} onPress={() => {
                    animateLayout();
                    setShowBlockForm(true);
                  }}>
                    <Text style={styles.btnPrimaryText}>Bloquear Agenda</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.formCard}>
                    <Text style={styles.inputLabel}>Bloquear {adminDate.split('-').reverse().join('/')}</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      <TouchableOpacity
                        style={[styles.slotBadge, blockMode === 'day' && styles.slotBadgeActive]}
                        onPress={() => setBlockMode('day')}
                      >
                        <Text style={[styles.slotBadgeText, blockMode === 'day' && styles.slotBadgeTextActive]}>Dia Inteiro</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.slotBadge, blockMode === 'range' && styles.slotBadgeActive]}
                        onPress={() => setBlockMode('range')}
                      >
                        <Text style={[styles.slotBadgeText, blockMode === 'range' && styles.slotBadgeTextActive]}>Intervalo de Horas</Text>
                      </TouchableOpacity>
                    </View>

                    {blockMode === 'range' && (
                      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inputLabel}>Início</Text>
                          <TextInput
                            style={styles.textInput}
                            value={blockStart}
                            onChangeText={setBlockStart}
                            placeholder="09:00"
                            placeholderTextColor={THEME.textMuted}
                            keyboardType="numbers-and-punctuation"
                            maxLength={5}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inputLabel}>Fim</Text>
                          <TextInput
                            style={styles.textInput}
                            value={blockEnd}
                            onChangeText={setBlockEnd}
                            placeholder="15:00"
                            placeholderTextColor={THEME.textMuted}
                            keyboardType="numbers-and-punctuation"
                            maxLength={5}
                          />
                        </View>
                      </View>
                    )}

                    <Text style={styles.inputLabel}>Motivo</Text>
                    <TextInput
                      style={styles.textInput}
                      value={blockReason}
                      onChangeText={setBlockReason}
                      placeholder="Folga, Férias, Compromisso..."
                      placeholderTextColor={THEME.textMuted}
                    />

                    <View style={styles.actionButtons}>
                      <TouchableOpacity style={styles.btnSecondary} onPress={() => {
                        animateLayout();
                        setShowBlockForm(false);
                      }}>
                        <Text style={styles.btnSecondaryText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.btnPrimary} onPress={handleBlockDay}>
                        <Text style={styles.btnPrimaryText}>Salvar Bloqueio</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>

              <View style={[styles.calendarContainer, { marginHorizontal: 16 }]}>
                <Calendar
                  current={adminDate}
                  onDayPress={(day: any) => {
                    setAdminDate(day.dateString);
                    fetchAdminAppointments(day.dateString);
                  }}
                  markedDates={{
                    [adminDate]: {
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

              {loadingAdmin ? (
                <SkeletonList height={80} />
              ) : (
                <FlatList
                  data={appointmentsList}
                  keyExtractor={(item) => item.id.toString()}
                  contentContainerStyle={[styles.list, { marginTop: 16 }]}
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>Nenhum atendimento para esta data.</Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const startTimeFormatted = new Date(item.startTime).toLocaleTimeString('pt-BR', {
                      timeZone: 'America/Sao_Paulo',
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const isCancelled = item.status === 'Cancelled';
                    const isBlocked = item.status === 'Blocked';

                    // Define styles based on status
                    let badgeText, badgeColor;
                    if (isCancelled) {
                      badgeText = 'Cancelado';
                      badgeColor = styles.badgeCancelled;
                    } else if (isBlocked) {
                      badgeText = 'Bloqueado';
                      badgeColor = { backgroundColor: '#F0F0F0', borderColor: '#CCCCCC' }; // Neutral gray
                    } else {
                      badgeText = 'Confirmado';
                      badgeColor = styles.badgeConfirmed;
                    }

                    return (
                      <View style={[styles.adminCard, isCancelled && styles.cardCancelled, isBlocked && { backgroundColor: '#F8F8F8' }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.adminClientTitle}>{item.clientName}</Text>
                          <Text style={styles.adminSubText}>
                            {item.serviceItem?.name || 'Serviço'} • {startTimeFormatted}
                          </Text>
                          <Text style={styles.adminPhoneText}>WhatsApp: {item.clientPhone}</Text>
                          {item.clientAddress ? (
                            <Text style={styles.adminPhoneText}>Local: {item.clientAddress}</Text>
                          ) : null}
                          {item.travelFee != null && item.distanceKm != null ? (
                            <Text style={styles.adminPhoneText}>
                              {item.travelFee > 0
                                ? `🚗 ${item.distanceKm.toFixed(1)} km • Deslocamento: R$ ${formatBRL(item.travelFee)} • Total: R$ ${formatBRL((item.serviceItem?.price ?? 0) + item.travelFee)}`
                                : `✨ ${item.distanceKm.toFixed(1)} km • Deslocamento gratuito`}
                            </Text>
                          ) : null}
                          {item.description ? (
                            <Text style={styles.adminPhoneText}>Pedido: {item.description}</Text>
                          ) : null}
                          {item.referenceImages && item.referenceImages.length > 0 && adminToken ? (
                            <View style={[styles.imagesRow, { marginTop: 6 }]}>
                              {item.referenceImages.map((name) => {
                                const source = {
                                  uri: `${api.defaults.baseURL}/appointments/images/${name}`,
                                  headers: { Authorization: `Bearer ${adminToken}` },
                                };
                                return (
                                  <TouchableOpacity key={name} activeOpacity={0.85} onPress={() => setLightbox(source)}>
                                    <Image source={source} style={styles.thumb} />
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
                          <Text style={[styles.badgeText, badgeColor]}>
                            {badgeText}
                          </Text>
                        </View>

                        {!isBlocked && (
                          <View style={styles.quickActions}>
                            <TouchableOpacity style={styles.quickBtn} onPress={() => openWhatsApp(item)}>
                              <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                            </TouchableOpacity>
                            {item.clientAddress ? (
                              <TouchableOpacity style={styles.quickBtn} onPress={() => openMap(item.clientAddress!)}>
                                <Ionicons name="location-outline" size={18} color={THEME.roseDark} />
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        )}

                        {!isCancelled && !isBlocked && (
                          <TouchableOpacity
                            style={styles.cancelAction}
                            onPress={() => handleCancelAppointment(item.id)}
                          >
                            <Text style={styles.cancelActionText}>Desmarcar</Text>
                          </TouchableOpacity>
                        )}

                        {isBlocked && (
                          <TouchableOpacity
                            style={[styles.cancelAction, { backgroundColor: '#FFE4B5' }]}
                            onPress={() => handleCancelAppointment(item.id)}
                          >
                            <Text style={styles.cancelActionText}>Desbloquear</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  }}
                />
              )}
            </View>
          )}
        </View>
      </ImageBackground>

      <Modal visible={!!lightbox} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <View style={styles.lightbox}>
          {lightbox && <Image source={lightbox} style={styles.lightboxImage} resizeMode="contain" />}
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightbox(null)}>
            <Ionicons name="close" size={26} color={THEME.white} />
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.cream,
  },
  backgroundWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  backgroundImage: {
    opacity: 0.30,
    resizeMode: 'cover',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(250, 249, 248, 0.4)',
  },
  toast: {
    position: 'absolute',
    top: 40,
    left: 16,
    right: 16,
    zIndex: 100,
    elevation: 10,
    padding: 14,
    borderRadius: 10,
    borderLeftWidth: 5,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  toastSuccess: { borderLeftColor: '#386641', backgroundColor: '#EAF4EC' },
  toastError: { borderLeftColor: '#9E2A2B', backgroundColor: '#FCECEB' },
  toastWarn: { borderLeftColor: '#B7791F', backgroundColor: '#FFF6E0' },
  toastTitle: { fontSize: 14, fontWeight: '700', color: THEME.text },
  toastMessage: { fontSize: 13, color: THEME.textLight, marginTop: 2 },
  brandBar: {
    alignItems: 'center',
    paddingTop: 45,
    paddingBottom: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderBottomWidth: 1,
    borderColor: THEME.border,
    justifyContent: 'center',
  },
 brandTitle: {
    fontFamily: 'CormorantGaramond_400Regular', // <-- A fonte entra aqui
    fontSize: 22, // Pode aumentar um pouco o tamanho, pois as fontes com serifa tendem a parecer menores
    letterSpacing: 2.5,
    color: THEME.text,
    textTransform: 'uppercase',
  },
  brandSubtitle: {
    fontFamily: 'CormorantGaramond_400Regular_Italic', // <-- Versão itálica para a palavra "Beauty"
    color: THEME.rose,
    textTransform: 'none',
  },
  welcomeTitle: {
    fontFamily: 'CormorantGaramond_400Regular', // <-- A fonte entra aqui também
    fontSize: 36,
    letterSpacing: 3,
    color: THEME.text,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  brandTagline: {
    fontSize: 10,
    letterSpacing: 1,
    color: THEME.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  topNav: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.border,
    padding: 3,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 6,
  },
  navBtnActive: {
    backgroundColor: THEME.roseDark,
  },
  navText: {
    fontSize: 12,
    letterSpacing: 0.5,
    color: THEME.textLight,
    fontWeight: '500',
  },
  navTextActive: {
    color: THEME.white,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '400',
    color: THEME.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: THEME.textLight,
    marginTop: 2,
    fontWeight: '300',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  serviceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 18,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: THEME.text,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  durationText: {
    fontSize: 12,
    color: THEME.textMuted,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.roseDark,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHeader: {
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: THEME.roseDark,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 8,
  },
  calendarContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: THEME.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: THEME.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  slotBadgeActive: {
    backgroundColor: THEME.rose,
    borderColor: THEME.rose,
  },
  slotBadgeText: {
    fontSize: 13,
    color: THEME.text,
    fontWeight: '400',
  },
  slotBadgeTextActive: {
    color: THEME.white,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyText: {
    color: THEME.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
  },
  formCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  inputLabel: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontWeight: '500',
    color: THEME.roseDark,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: THEME.cream,
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: THEME.text,
  },
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
  imagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumbWrapper: {
    width: 64,
    height: 64,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: THEME.roseLight,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#9E2A2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageBtn: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: THEME.rose,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addImageText: {
    fontSize: 10,
    color: THEME.roseDark,
  },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  successIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: THEME.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 26, fontWeight: '600', color: THEME.text, marginTop: 8, textAlign: 'center' },
  successSub: { fontSize: 14, color: THEME.textLight, textAlign: 'center' },
  successCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    padding: 20,
    marginVertical: 8,
    borderRadius: 16,
    backgroundColor: THEME.white,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  successHint: { fontSize: 12, color: THEME.textMuted, textAlign: 'center' },
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
  disclaimerText: {
    fontSize: 11,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 22,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: THEME.textLight,
    fontWeight: '500',
    fontSize: 13,
  },
  btnPrimary: {
    flex: 2,
    paddingVertical: 14,
    backgroundColor: THEME.rose,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: THEME.white,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  adminCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardCancelled: {
    opacity: 0.5,
    backgroundColor: '#F2EFEB',
  },
  adminClientTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.text,
  },
  adminSubText: {
    fontSize: 13,
    color: THEME.textLight,
    marginTop: 2,
  },
  adminPhoneText: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2,
  },
  badgeText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  badgeConfirmed: {
    color: '#386641',
  },
  badgeCancelled: {
    color: '#9E2A2B',
  },
  cancelAction: {
    backgroundColor: '#FCECEB',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  cancelActionText: {
    color: '#9E2A2B',
    fontSize: 12,
    fontWeight: '600',
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center', // Centraliza os blocos na tela
    paddingHorizontal: 24,
  },
  welcomeContent: {
    alignItems: 'center',
    marginBottom: 50, // Dá um respiro bonito antes dos botões
    backgroundColor: 'rgba(255, 255, 255, 0.6)', // Leve fundo para destacar o texto
    padding: 20,
    borderRadius: 16,
  },
  welcomeIcon: {
    marginBottom: 16,
    opacity: 0.9,
  },

  welcomeTagline: {
    fontSize: 12,
    letterSpacing: 2,
    color: THEME.roseDark,
    textTransform: 'uppercase',
    marginTop: 12,
    textAlign: 'center',
    fontWeight: '600',
  },
  welcomeDesc: {
    fontSize: 14,
    color: THEME.textLight,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },
  welcomeActions: {
    gap: 14,
    width: '100%',
  },
  welcomeBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: THEME.rose,
    paddingVertical: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  welcomeBtnPrimaryText: {
    color: THEME.white,
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  welcomeBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: THEME.border,
    paddingVertical: 14,
    borderRadius: 10,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  stepItem: { alignItems: 'center', gap: 4, width: 90 },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.rose,
    backgroundColor: THEME.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: { backgroundColor: THEME.roseDark, borderColor: THEME.roseDark },
  stepDotText: { fontSize: 12, fontWeight: '600', color: THEME.white },
  stepLabel: { fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: THEME.textMuted, textAlign: 'center' },
  stepLabelActive: { color: THEME.roseDark, fontWeight: '600' },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: THEME.roseLight,
    marginBottom: 18,
    borderRadius: 1,
    overflow: 'hidden',
  },
  stepLineFill: { height: 2, backgroundColor: THEME.roseDark },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  moodChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.rose,
    backgroundColor: THEME.cream,
  },
  moodChipActive: { backgroundColor: THEME.roseDark, borderColor: THEME.roseDark },
  moodChipText: { fontSize: 12, color: THEME.roseDark },
  moodChipTextActive: { color: THEME.white, fontWeight: '600' },
  ticket: {
    marginTop: 20,
    backgroundColor: THEME.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.rose,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  ticketHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ticketKicker: { fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', color: THEME.roseDark },
  ticketService: {
    fontFamily: 'CormorantGaramond_400Regular',
    fontSize: 26,
    color: THEME.text,
    marginTop: 10,
    textAlign: 'center',
  },
  ticketDate: { fontSize: 14, color: THEME.textLight, marginTop: 4, textTransform: 'capitalize', textAlign: 'center' },
  ticketDivider: {
    alignSelf: 'stretch',
    marginVertical: 16,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: THEME.rose,
  },
  ticketFooter: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  ticketLabel: { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: THEME.textMuted },
  ticketValue: { fontSize: 15, fontWeight: '500', color: THEME.text, marginTop: 2 },
  ticketPrice: { fontSize: 22, fontWeight: '600', color: THEME.roseDark, marginTop: 2 },
  lightbox: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  lightboxImage: { width: '100%', height: '85%' },
  lightboxClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeBtnOutlineText: {
    color: THEME.roseDark,
    fontWeight: '600',
    fontSize: 14,
  },
});