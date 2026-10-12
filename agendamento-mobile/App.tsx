import React, { useEffect, useState } from 'react';
import { useFonts, CormorantGaramond_400Regular, CormorantGaramond_400Regular_Italic } from '@expo-google-fonts/cormorant-garamond';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  TextInput,
  ScrollView,
  Alert,
  ImageBackground,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import api from './src/services/api';

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
}

export default function App() {
  // 1. Carregar a fonte (mantenha como você já fez)
  const [fontsLoaded] = useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
  });

  // Atualize esta linha:
  const [viewMode, setViewMode] = useState<'welcome' | 'client' | 'adminLogin' | 'admin'>('welcome');
  
  // Adicione este novo estado para a senha:
  const [adminPassword, setAdminPassword] = useState('');
  const [step, setStep] = useState<1 | 2>(1);

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

  // Estados da Administração
  const [adminDate, setAdminDate] = useState(todayStr);
  const [appointmentsList, setAppointmentsList] = useState<AppointmentItem[]>([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // Estados visuais
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await api.get<ServiceItem[]>('/services');
      setServices(response.data);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar os serviços da API.');
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
      Alert.alert('Erro', 'Falha ao procurar horários livres para esta data.');
    } finally {
      setLoadingSlots(false);
    }
  };

  const fetchAdminAppointments = async (dateStr: string) => {
    try {
      setLoadingAdmin(true);
      const response = await api.get<AppointmentItem[]>('/appointments', {
        params: { date: dateStr },
      });
      setAppointmentsList(response.data);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível carregar os agendamentos.');
    } finally {
      setLoadingAdmin(false);
    }
  };

  const handleSelectService = (service: ServiceItem) => {
    setSelectedService(service);
    setStep(2);
    fetchAvailableSlots(service.id, selectedDate);
  };

  const handlePhoneChange = (text: string) => {
    const raw = text.replace(/\D/g, '');
    let formatted = raw;
    if (raw.length > 2) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2)}`;
    }
    if (raw.length > 7) {
      formatted = `(${raw.slice(0, 2)}) ${raw.slice(2, 7)}-${raw.slice(7, 11)}`;
    }
    setClientPhone(formatted);
  };

  const handleConfirmAppointment = async () => {
    if (!selectedSlot) {
      Alert.alert('Horário', 'Selecione um horário disponível.');
      return;
    }
    if (!clientName.trim() || clientPhone.replace(/\D/g, '').length < 10) {
      Alert.alert('Atenção', 'Preencha o seu nome e um WhatsApp válido.');
      return;
    }

    try {
      setLoading(true);
      const startTimeIso = `${selectedDate}T${selectedSlot}:00Z`;

      await api.post('/appointments', {
        clientName,
        clientPhone,
        clientAddress,
        serviceItemId: selectedService?.id,
        startTime: startTimeIso,
      });

      Alert.alert('Agendamento Confirmado!', 'Receberá os detalhes via WhatsApp.', [
        {
          text: 'Concluir',
          onPress: () => {
            setStep(1);
            setSelectedService(null);
            setSelectedSlot(null);
            setClientName('');
            setClientPhone('');
            setClientAddress('');
            setViewMode('welcome'); // Volta para a tela inicial ao concluir
          },
        },
      ]);
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Erro ao confirmar agendamento.';
      Alert.alert('Aviso', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (id: number) => {
    try {
      await api.patch(`/appointments/${id}/status`, 'Cancelled', {
        headers: { 'Content-Type': 'application/json' },
      });
      Alert.alert('Sucesso', 'Marcação desmarcada com sucesso.');
      fetchAdminAppointments(adminDate);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao desmarcar.');
    }
  };

  const handleAdminLogin = () => {
    // Senha simples para o MVP (pode alterar para a que desejar)
    if (adminPassword === 'SUA_SENHA') {
      setAdminPassword(''); // Limpa o campo
      setViewMode('admin');
      fetchAdminAppointments(adminDate);
    } else {
      Alert.alert('Acesso Negado', 'A senha informada está incorreta.');
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

              <TouchableOpacity
                style={[styles.navBtn, viewMode === 'admin' && styles.navBtnActive]}
                onPress={() => {
                  setViewMode('admin');
                  fetchAdminAppointments(adminDate);
                }}
              >
                <Ionicons name="calendar-outline" size={14} color={viewMode === 'admin' ? THEME.white : THEME.textLight} />
                <Text style={[styles.navText, viewMode === 'admin' && styles.navTextActive]}>Painel Ateliê</Text>
              </TouchableOpacity>
            </View>
          )}

{/* --- TELA INICIAL (WELCOME) --- */}
          {viewMode === 'welcome' && (
            <View style={styles.welcomeContainer}>
              <View style={styles.welcomeContent}>
                {/* Ícone decorativo de estrelinhas/brilho */}
                
                
                <Text style={styles.welcomeTitle}>
                  Lari Novais <Text style={styles.brandSubtitle}>Beauty</Text>
                </Text>
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
                    setViewMode('admin');
                    fetchAdminAppointments(adminDate);
                  }}
                >
                  <Ionicons name="calendar-outline" size={16} color={THEME.roseDark} />
                  <Text style={styles.welcomeBtnOutlineText}>Área da Maquiadora</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* --- FLUXO CLIENTE --- */}
          {viewMode === 'client' && (
            <View style={{ flex: 1 }}>
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
                  <ActivityIndicator size="large" color={THEME.roseDark} style={{ marginTop: 40 }} />
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
                    <ActivityIndicator size="small" color={THEME.roseDark} style={{ marginVertical: 14 }} />
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
                            onPress={() => setSelectedSlot(slot)}
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

                    <Text style={[styles.inputLabel, { marginTop: 12 }]}>Endereço do Atendimento</Text>
                    <TextInput
                      style={[styles.textInput, { height: 65, textAlignVertical: 'top' }]}
                      value={clientAddress}
                      onChangeText={setClientAddress}
                      placeholder="Rua, Número, Bairro (Para cálculo de rota)"
                      placeholderTextColor={THEME.textMuted}
                      multiline
                    />
                  </View>

                  <Text style={styles.disclaimerText}>
                    * O valor final pode sofrer acréscimo de taxa de deslocamento dependendo da região.
                  </Text>

                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.btnSecondary}
                      onPress={() => setStep(1)}
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
                <ActivityIndicator size="large" color={THEME.roseDark} style={{ marginTop: 20 }} />
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
                    const startTimeFormatted = new Date(item.startTime).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const isCancelled = item.status === 'Cancelled';

                    return (
                      <View style={[styles.adminCard, isCancelled && styles.cardCancelled]}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.adminClientTitle}>{item.clientName}</Text>
                          <Text style={styles.adminSubText}>
                            {item.serviceItem?.name || 'Serviço'} • {startTimeFormatted}
                          </Text>
                          <Text style={styles.adminPhoneText}>WhatsApp: {item.clientPhone}</Text>
                          {item.clientAddress ? (
                            <Text style={styles.adminPhoneText}>Local: {item.clientAddress}</Text>
                          ) : null}
                          <Text style={[styles.badgeText, isCancelled ? styles.badgeCancelled : styles.badgeConfirmed]}>
                            {isCancelled ? 'Cancelado' : 'Confirmado'}
                          </Text>
                        </View>

                        {!isCancelled && (
                          <TouchableOpacity
                            style={styles.cancelAction}
                            onPress={() => handleCancelAppointment(item.id)}
                          >
                            <Text style={styles.cancelActionText}>Desmarcar</Text>
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
  welcomeBtnOutlineText: {
    color: THEME.roseDark,
    fontWeight: '600',
    fontSize: 14,
  },
});