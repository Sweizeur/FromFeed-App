import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity, useColorScheme } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { Colors, darkColor } from '@/constants/theme';

interface DatePickerModalProps {
  visible: boolean;
  date: Date;
  onDateSelect: (date: Date) => void;
  onClose: () => void;
}

export default function DatePickerModal({ visible, date, onDateSelect, onClose }: DatePickerModalProps) {
  if (!visible) return null;
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  return (
    <View style={[styles.modal, { backgroundColor: theme.surface, shadowColor: isDark ? '#000' : darkColor }]}>
      <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.modalTitle, { color: theme.text }]}>Sélectionner une date</Text>
        <TouchableOpacity onPress={onClose}>
          <Ionicons name="close" size={24} color={theme.text} />
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
            backgroundColor: theme.surface,
            calendarBackground: theme.surface,
            textSectionTitleColor: theme.icon,
            selectedDayBackgroundColor: darkColor,
            selectedDayTextColor: '#ffffff',
            todayTextColor: theme.text,
            dayTextColor: theme.text,
            textDisabledColor: '#d9d9d9',
            dotColor: darkColor,
            selectedDotColor: '#ffffff',
            arrowColor: darkColor,
            monthTextColor: theme.text,
            textDayFontWeight: '400',
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
            textDayFontSize: 16,
            textMonthFontSize: 18,
            textDayHeaderFontSize: 13,
          }}
          style={[styles.calendar, { borderColor: theme.border }]}
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
  calendarContainer: {
    padding: 16,
  },
  calendar: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 8,
  },
});

