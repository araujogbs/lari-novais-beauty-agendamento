import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SkeletonList } from '../../components/Skeleton';
import { common } from '../../styles/common';
import { THEME } from '../../theme';
import type { ServiceItem } from '../../types';
import { formatBRL } from '../../utils/format';

interface Props {
  services: ServiceItem[];
  loading: boolean;
  selectedIds: number[];
  onToggle: (service: ServiceItem) => void;
  onContinue: () => void;
}

/** Etapa 1: lista de serviços. Mais de um pode ser marcado; o valor e a duração somam. */
export function ServiceStep({ services, loading, selectedIds, onToggle, onContinue }: Props) {
  if (loading) return <SkeletonList height={72} />;

  const total = services.filter((s) => selectedIds.includes(s.id)).reduce((sum, s) => sum + s.price, 0);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={services}
        keyExtractor={(item) => item.id.toString()}
        extraData={selectedIds}
        contentContainerStyle={common.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<Text style={styles.hint}>Você pode marcar mais de um serviço.</Text>}
        renderItem={({ item }) => {
          const selected = selectedIds.includes(item.id);
          return (
            <TouchableOpacity
              style={[styles.serviceCard, selected && styles.serviceCardSelected]}
              activeOpacity={0.85}
              onPress={() => onToggle(item)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
            >
              <Ionicons
                name={selected ? 'checkbox' : 'square-outline'}
                size={22}
                color={selected ? THEME.roseDark : THEME.textMuted}
                style={{ marginRight: 12 }}
              />
              <View style={styles.serviceInfo}>
                <Text style={styles.serviceTitle}>{item.name}</Text>
                <View style={styles.durationRow}>
                  <Ionicons name="time-outline" size={14} color={THEME.textMuted} />
                  <Text style={styles.durationText}>{item.durationMinutes} minutos</Text>
                </View>
              </View>
              <Text style={styles.priceText}>R$ {formatBRL(item.price)}</Text>
            </TouchableOpacity>
          );
        }}
      />
      {selectedIds.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerTotal}>Total: R$ {formatBRL(total)}</Text>
          <TouchableOpacity style={[common.btnPrimary, { flex: 0, paddingHorizontal: 24 }]} onPress={onContinue}>
            <Text style={common.btnPrimaryText}>Continuar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
  serviceCardSelected: {
    borderColor: THEME.roseDark,
    backgroundColor: THEME.white,
  },
  hint: {
    fontSize: 12,
    color: THEME.textMuted,
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    backgroundColor: THEME.white,
  },
  footerTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME.text,
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
  priceText: {
    fontSize: 15,
    fontWeight: '600',
    color: THEME.roseDark,
  },
});
