import React from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { common } from '../styles/common';
import { THEME } from '../theme';

interface Props {
  onSchedule: () => void;
  onMyAppointments: () => void;
  onOpenAdmin: () => void;
}

export function WelcomeScreen({ onSchedule, onMyAppointments, onOpenAdmin }: Props) {
  return (
    <View style={styles.welcomeContainer}>
      <View style={styles.welcomeContent}>
        {/* Área da maquiadora fica escondida: abre com toque longo no título */}
        <Pressable onLongPress={onOpenAdmin} delayLongPress={4000}>
          <Text style={common.welcomeTitle}>
            Lari Novais <Text style={common.brandSubtitle}>Beauty</Text>
          </Text>
        </Pressable>
        <Text style={common.welcomeTagline}>Beleza com Naturalidade, Técnica e Identidade</Text>
        <Text style={styles.welcomeDesc}>
          Atendimento exclusivo e personalizado a domicílio para casamentos, formaturas e eventos sociais.
        </Text>
      </View>

      <View style={styles.welcomeActions}>
        <TouchableOpacity style={styles.welcomeBtnPrimary} onPress={onSchedule}>
          <Ionicons name="sparkles" size={18} color={THEME.white} />
          <Text style={styles.welcomeBtnPrimaryText}>Agendar Meu Horário</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.welcomeBtnOutline} onPress={onMyAppointments}>
          <Ionicons name="calendar-outline" size={18} color={THEME.roseDark} />
          <Text style={styles.welcomeBtnOutlineText}>Meus Agendamentos</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
