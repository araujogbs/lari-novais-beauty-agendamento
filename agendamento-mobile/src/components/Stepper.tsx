import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../theme';

// Indicador de etapas com linha que preenche
export function Stepper({ step }: { step: 1 | 2 }) {
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

const styles = StyleSheet.create({
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
});
