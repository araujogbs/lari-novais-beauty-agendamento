import { StyleSheet } from 'react-native';
import { THEME } from '../../theme';

// Estilos da etapa "Data & Detalhes", compartilhados entre as seções dela
export const bookingStyles = StyleSheet.create({
  sectionHeader: {
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: THEME.roseDark,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 8,
  },
  disclaimerText: {
    fontSize: 11,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 10,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
