import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { THEME } from '../theme';
import type { ToastData } from '../types';

export function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onDismiss}
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
  );
}

const styles = StyleSheet.create({
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
});
