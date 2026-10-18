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
  onSelect: (service: ServiceItem) => void;
}

/** Etapa 1: lista de serviços. */
export function ServiceStep({ services, loading, onSelect }: Props) {
  if (loading) return <SkeletonList height={72} />;

  return (
    <FlatList
      data={services}
      keyExtractor={(item) => item.id.toString()}
      contentContainerStyle={common.list}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.serviceCard} activeOpacity={0.85} onPress={() => onSelect(item)}>
          <View style={styles.serviceInfo}>
            <Text style={styles.serviceTitle}>{item.name}</Text>
            <View style={styles.durationRow}>
              <Ionicons name="time-outline" size={14} color={THEME.textMuted} />
              <Text style={styles.durationText}>{item.durationMinutes} minutos</Text>
            </View>
          </View>
          <View style={styles.priceContainer}>
            <Text style={styles.priceText}>R$ {formatBRL(item.price)}</Text>
            <Ionicons name="chevron-forward" size={16} color={THEME.roseDark} />
          </View>
        </TouchableOpacity>
      )}
    />
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
});
