import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { darkColor } from '@/constants/theme';

interface DatePickerModalProps {
  visible: boolean;
  date: Date;
  onDateSelect: (date: Date) => void;
  onClose: () => void;
}

export default function DatePickerModal({ visible, date, onDateSelect, onClose }: DatePickerModalProps) {
  if (!visible) return null;

  return (
    <View style={styles.modal}>
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>Sélectionner une date</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={darkColor} />
        </TouchableOpacity>
      </View>
      <View style={styles.calendarContainer}>
        <Calendar
          current={date.toISOString().split('T')[0]}
          onDayPress={(day) => {
            onDateSelect(new Date(day.dateString));
            onClose();
          }}
          markedDates={{
            [date.toISOString().split('T')[0]]: {
              selected: true,
              selectedColor: darkColor,
            },
          }}
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: darkColor,
            selectedDayBackgroundColor: darkColor,
            selectedDayTextColor: '#ffffff',
            todayTextColor: darkColor,
            dayTextColor: darkColor,
            textDisabledColor: '#d9d9d9',
            dotColor: darkColor,
            selectedDotColor: '#ffffff',
            arrowColor: darkColor,
            monthTextColor: darkColor,
            textDayFontWeight: '400',
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 16,
            textMonthFontSize: 18,
            textDayHeaderFontSize: 13,
          }}
          style={styles.calendar}
        />
      </View>
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
  calendarContainer: {
    padding: 16,
  },
  calendar: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 8,
  },
});

