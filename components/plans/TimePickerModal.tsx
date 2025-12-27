import React from 'react';
import { View, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { darkColor } from '@/constants/theme';

interface TimePickerModalProps {
  visible: boolean;
  time: string;
  onTimeChange: (time: string) => void;
  onClose: () => void;
}

export default function TimePickerModal({ visible, time, onTimeChange, onClose }: TimePickerModalProps) {
  if (!visible) return null;

  return (
    <View style={styles.modal}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Heure</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={darkColor} />
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.input}
        value={time}
        onChangeText={onTimeChange}
        placeholder="HH:mm"
        placeholderTextColor="#999"
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
    backgroundColor: '#fff',
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
    borderBottomColor: '#EFEFEF',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: darkColor,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: darkColor,
    backgroundColor: '#fff',
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

