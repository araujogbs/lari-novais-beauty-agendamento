import { StyleSheet } from 'react-native';
import { THEME } from '../theme';

// Estilos usados por mais de uma tela. O que é de uma tela só fica no arquivo dela.
export const common = StyleSheet.create({
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
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },

  /* marca */
  brandSubtitle: {
    fontFamily: 'CormorantGaramond_400Regular_Italic', // Versão itálica para a palavra "Beauty"
    color: THEME.rose,
    textTransform: 'none',
  },
  welcomeTitle: {
    fontFamily: 'CormorantGaramond_400Regular',
    fontSize: 36,
    letterSpacing: 3,
    color: THEME.text,
    textTransform: 'uppercase',
    textAlign: 'center',
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

  /* formulários e botões */
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

  /* calendário, horários e fotos */
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
  imagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: THEME.roseLight,
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

  /* cartões de agendamento (cliente e painel) */
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

  /* "convite" (resumo do agendamento) */
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
  ticketLabel: { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: THEME.textMuted },
  ticketPrice: { fontSize: 22, fontWeight: '600', color: THEME.roseDark, marginTop: 2 },
});
