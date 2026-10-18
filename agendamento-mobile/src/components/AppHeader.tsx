import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { common } from '../styles/common';
import { THEME } from '../theme';
import type { ViewMode } from '../types';

interface Props {
  viewMode: ViewMode;
  onNavigate: (mode: ViewMode) => void;
  onLogout: () => void;
}

/** Cabeçalho da marca e, fora da tela inicial, a barra de navegação. */
export function AppHeader({ viewMode, onNavigate, onLogout }: Props) {
  return (
    <>
      <View style={styles.brandBar}>
        {viewMode !== 'welcome' && (
          <TouchableOpacity style={{ position: 'absolute', left: 20, top: 48 }} onPress={() => onNavigate('welcome')}>
            <Ionicons name="home-outline" size={22} color={THEME.textLight} />
          </TouchableOpacity>
        )}
        <Text style={styles.brandTitle}>
          Lari Novais <Text style={common.brandSubtitle}>Beauty</Text>
        </Text>
        <Text style={styles.brandTagline}>Atendimento a Domicílio</Text>
      </View>

      {viewMode !== 'welcome' && (
        <View style={styles.topNav}>
          <TouchableOpacity
            style={[styles.navBtn, viewMode === 'client' && styles.navBtnActive]}
            onPress={() => onNavigate('client')}
          >
            <Ionicons name="sparkles-outline" size={14} color={viewMode === 'client' ? THEME.white : THEME.textLight} />
            <Text style={[styles.navText, viewMode === 'client' && styles.navTextActive]}>Agendar Horário</Text>
          </TouchableOpacity>

          {viewMode === 'admin' && (
            <>
              <TouchableOpacity style={[styles.navBtn, styles.navBtnActive]} onPress={() => onNavigate('admin')}>
                <Ionicons name="calendar-outline" size={14} color={THEME.white} />
                <Text style={[styles.navText, styles.navTextActive]}>Painel Ateliê</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.navBtn} onPress={onLogout}>
                <Ionicons name="log-out-outline" size={14} color={THEME.textLight} />
                <Text style={[styles.navText, { color: THEME.textLight }]}>Sair</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
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
    fontFamily: 'CormorantGaramond_400Regular',
    fontSize: 22,
    letterSpacing: 2.5,
    color: THEME.text,
    textTransform: 'uppercase',
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
});
