import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAX_PEOPLE } from '../../constants';
import { THEME } from '../../theme';

interface Props {
  people: number;
  onChange: (people: number) => void;
}

export function PeopleSelector({ people, onChange }: Props) {
  return (
    <View style={styles.peopleRow}>
      <TouchableOpacity
        style={[styles.peopleBtn, people <= 1 && styles.peopleBtnDisabled]}
        disabled={people <= 1}
        accessibilityLabel="Diminuir pessoas"
        onPress={() => onChange(people - 1)}
      >
        <Ionicons name="remove" size={20} color={THEME.roseDark} />
      </TouchableOpacity>
      <Text style={styles.peopleCount}>
        {people} {people === 1 ? 'pessoa' : 'pessoas'}
      </Text>
      <TouchableOpacity
        style={[styles.peopleBtn, people >= MAX_PEOPLE && styles.peopleBtnDisabled]}
        disabled={people >= MAX_PEOPLE}
        accessibilityLabel="Aumentar pessoas"
        onPress={() => onChange(people + 1)}
      >
        <Ionicons name="add" size={20} color={THEME.roseDark} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  peopleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: THEME.border,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  peopleBtnDisabled: {
    opacity: 0.4,
  },
  peopleCount: {
    fontSize: 16,
    color: THEME.text,
    minWidth: 90,
    textAlign: 'center',
  },
});
