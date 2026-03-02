import React from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, darkColor } from '@/constants/theme';

interface TimePickerModalProps {
  visible: boolean;
  time: string;
  onTimeChange: (time: string) => void;
  onClose: () => void;
}

export default function TimePickerModal({ visible, time, onTimeChange, onClose }: TimePickerModalProps) {
  if (!visible) return null;
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  return (
    <View style={[styles.modal, { backgroundColor: theme.surface, shadowColor: isDark ? '#000' : darkColor }]}>
      <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.modalTitle, { color: theme.text }]}>Heure</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={theme.text} />
        </TouchableOpacity>
      </View>
      <TextInput
        style={[styles.input, { borderColor: theme.border, backgroundColor: theme.background, color: theme.text }]}
        value={time}
        onChangeText={onTimeChange}
        placeholder="HH:mm"
        placeholderTextColor={theme.icon}
        maxLength={5}
      />
      <TouchableOpacity style={styles.modalButton} onPress={onClose}>
        <Text style={styles.modalButtonText}>Valider</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  modal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    zIndex: 1001,
    shadowColor: darkColor,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    margin: 16,
  },
  modalButton: {
    backgroundColor: darkColor,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    margin: 16,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

