import React, { useState } from 'react';
import { ImageBackground, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { useFonts, CormorantGaramond_400Regular, CormorantGaramond_400Regular_Italic } from '@expo-google-fonts/cormorant-garamond';
import './src/config/calendarLocale';
import { AppHeader } from './src/components/AppHeader';
import { Lightbox } from './src/components/Lightbox';
import { Toast } from './src/components/Toast';
import { useToast } from './src/hooks/useToast';
import { AdminLoginScreen } from './src/screens/AdminLoginScreen';
import { AdminScreen } from './src/screens/admin/AdminScreen';
import { BookingScreen } from './src/screens/booking/BookingScreen';
import { MyAppointmentsScreen } from './src/screens/MyAppointmentsScreen';
import { SuccessScreen } from './src/screens/SuccessScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { authService } from './src/services/auth';
import { THEME } from './src/theme';
import type { BookedSummary, LightboxSource, ViewMode } from './src/types';

export default function App() {
  useFonts({
    CormorantGaramond_400Regular,
    CormorantGaramond_400Regular_Italic,
  });

  const [viewMode, setViewMode] = useState<ViewMode>('welcome');
  const [booked, setBooked] = useState<BookedSummary | null>(null);
  const [myAppointmentsPhone, setMyAppointmentsPhone] = useState('');
  const [lightbox, setLightbox] = useState<LightboxSource | null>(null);
  const { toast, notify, dismiss } = useToast();

  const openAdminArea = async () => {
    const isAuthenticated = await authService.isAuthenticated();
    setViewMode(isAuthenticated ? 'admin' : 'adminLogin');
  };

  const logoutAdmin = async () => {
    await authService.removeToken();
    setViewMode('welcome');
  };

  const handleBooked = (summary: BookedSummary) => {
    setBooked(summary);
    setViewMode('success');
  };

  const openMyAppointments = (phone = '') => {
    setMyAppointmentsPhone(phone);
    setViewMode('myAppointments');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent={true} />

      {/* Background Elegante e Discreto */}
      <ImageBackground source={require('./assets/fundo.jpg')} style={styles.backgroundWrapper} imageStyle={styles.backgroundImage}>
        <View style={styles.overlay}>
          {toast && <Toast toast={toast} onDismiss={dismiss} />}

          <AppHeader viewMode={viewMode} onNavigate={setViewMode} onLogout={logoutAdmin} />

          {viewMode === 'welcome' && (
            <WelcomeScreen
              onSchedule={() => setViewMode('client')}
              onMyAppointments={() => openMyAppointments()}
              onOpenAdmin={openAdminArea}
            />
          )}

          {viewMode === 'client' && <BookingScreen notify={notify} openLightbox={setLightbox} onBooked={handleBooked} />}

          {viewMode === 'success' && booked && (
            <SuccessScreen booked={booked} onContinue={() => openMyAppointments(booked.phone)} />
          )}

          {viewMode === 'myAppointments' && <MyAppointmentsScreen notify={notify} initialPhone={myAppointmentsPhone} />}

          {viewMode === 'adminLogin' && <AdminLoginScreen notify={notify} onLoggedIn={() => setViewMode('admin')} />}

          {viewMode === 'admin' && (
            <AdminScreen notify={notify} openLightbox={setLightbox} onSessionExpired={() => setViewMode('adminLogin')} />
          )}
        </View>
      </ImageBackground>

      <Lightbox source={lightbox} onClose={() => setLightbox(null)} />
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
    opacity: 0.3,
    resizeMode: 'cover',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(250, 249, 248, 0.4)',
  },
});
