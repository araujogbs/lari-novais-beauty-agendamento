import React from 'react';
import { Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAX_IMAGES, MOOD_TAGS } from '../../constants';
import type { BookingForm } from '../../hooks/useBookingForm';
import { common } from '../../styles/common';
import { THEME } from '../../theme';
import type { OpenLightbox } from '../../types';

interface Props {
  form: BookingForm;
  openLightbox: OpenLightbox;
}

/** Descrição do pedido (com atalhos de estilo) e fotos de referência. */
export function DescriptionSection({ form, openLightbox }: Props) {
  const { images } = form;
  const selectedTags = form.description.split(',').map((t) => t.trim());

  return (
    <View style={common.formCard}>
      <Text style={common.inputLabel}>Descrição *</Text>
      <View style={styles.moodRow}>
        {MOOD_TAGS.map((tag) => {
          const active = selectedTags.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.moodChip, active && styles.moodChipActive]}
              onPress={() => form.toggleMoodTag(tag)}
            >
              <Text style={[styles.moodChipText, active && styles.moodChipTextActive]}>{tag}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TextInput
        style={[common.textInput, { height: 100, textAlignVertical: 'top' }]}
        value={form.description}
        onChangeText={form.setDescription}
        placeholder="Ex: make leve e natural, pele iluminada, olhos em tons de marrom..."
        placeholderTextColor={THEME.textMuted}
        multiline
        maxLength={1000}
      />

      <Text style={[common.inputLabel, { marginTop: 12 }]}>
        Imagens de referência (opcional) · {images.length}/{MAX_IMAGES}
      </Text>
      <View style={common.imagesRow}>
        {images.map((img, i) => (
          <View key={img.uri} style={styles.thumbWrapper}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => openLightbox({ uri: img.uri })}>
              <Image source={{ uri: img.uri }} style={common.thumb} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.thumbRemove} onPress={() => form.removeImage(i)}>
              <Ionicons name="close" size={14} color={THEME.white} />
            </TouchableOpacity>
          </View>
        ))}
        {images.length < MAX_IMAGES && (
          <TouchableOpacity style={styles.addImageBtn} onPress={form.pickImages}>
            <Ionicons name="image-outline" size={22} color={THEME.roseDark} />
            <Text style={styles.addImageText}>Adicionar</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  moodChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: THEME.rose,
    backgroundColor: THEME.cream,
  },
  moodChipActive: { backgroundColor: THEME.roseDark, borderColor: THEME.roseDark },
  moodChipText: { fontSize: 12, color: THEME.roseDark },
  moodChipTextActive: { color: THEME.white, fontWeight: '600' },
  thumbWrapper: {
    width: 64,
    height: 64,
  },
  thumbRemove: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#9E2A2B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageBtn: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: THEME.rose,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addImageText: {
    fontSize: 10,
    color: THEME.roseDark,
  },
});
