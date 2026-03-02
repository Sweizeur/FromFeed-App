import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform, Modal, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { type PlaceSummary } from '@/lib/api';
import { Colors, darkColor, darkColorWithAlpha } from '@/constants/theme';

// Import du DateTimePicker
import DateTimePicker from '@react-native-community/datetimepicker';

interface PlanActivity {
  placeId: string;
  order: number;
  startTime?: string;
  endTime?: string;
  notes?: string;
  place?: PlaceSummary;
}

interface ActivityRowProps {
  activity: PlanActivity;
  onTimeChange: (time: string, isEndTime?: boolean) => void;
  onRemove: () => void;
}

export default function ActivityRow({ activity, onTimeChange, onRemove }: ActivityRowProps) {
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];
  const [showPicker, setShowPicker] = useState(false);
  const [isEndTimePicker, setIsEndTimePicker] = useState(false);
  
  // Convertir l'heure string (HH:mm) en Date pour le picker
  const getTimeFromString = (timeString?: string): Date => {
    if (timeString) {
      const [hours, minutes] = timeString.split(':').map(Number);
      const date = new Date();
      date.setHours(hours || 0, minutes || 0, 0, 0);
      return date;
    }
    return new Date();
  };

  const getCurrentTime = () => {
    return isEndTimePicker ? activity.endTime : activity.startTime;
  };

  const [selectedTime, setSelectedTime] = useState(getTimeFromString(getCurrentTime()));

  // Mettre à jour selectedTime quand l'heure change depuis l'extérieur
  useEffect(() => {
    setSelectedTime(getTimeFromString(getCurrentTime()));
  }, [activity.startTime, activity.endTime, isEndTimePicker]);

  const handleTimeChange = (event: any, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        setSelectedTime(date);
        onTimeChange(timeString, isEndTimePicker);
      }
    } else if (Platform.OS === 'ios') {
      // Sur iOS, on met juste à jour la date sélectionnée
      // L'utilisateur validera avec le bouton
      if (date) {
        setSelectedTime(date);
      }
    }
  };

  const handleConfirm = () => {
    const hours = selectedTime.getHours().toString().padStart(2, '0');
    const minutes = selectedTime.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    onTimeChange(timeString, isEndTimePicker);
    setShowPicker(false);
  };

  const handleCancel = () => {
    // Restaurer l'heure précédente
    setSelectedTime(getTimeFromString(getCurrentTime()));
    setShowPicker(false);
  };

  const handleRemove = () => {
    onTimeChange('', isEndTimePicker);
    setShowPicker(false);
  };

  const formatTime = (time?: string): string => {
    if (!time || time.trim() === '' || !/^\d{2}:\d{2}$/.test(time)) {
      return 'Ajouter heure';
    }
    return time;
  };

  const openPicker = (isEnd: boolean) => {
    setIsEndTimePicker(isEnd);
    setSelectedTime(getTimeFromString(isEnd ? activity.endTime : activity.startTime));
    setShowPicker(true);
  };

  return (
    <View style={[styles.activityRow, { borderBottomColor: theme.border }]}>
      <View style={styles.activityContent}>
        <Text style={[styles.activityName, { color: theme.text }]} numberOfLines={1}>
          {activity.place?.placeName || activity.place?.rawTitle || 'Lieu sans nom'}
        </Text>
        {activity.place?.googleFormattedAddress && (
          <Text style={[styles.activityAddress, { color: theme.icon }]} numberOfLines={1}>
            {activity.place.googleFormattedAddress}
          </Text>
        )}
      </View>
      <View style={styles.timeButtonContainer}>
        <TouchableOpacity onPress={() => openPicker(false)} style={[styles.timeButton, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Text style={[styles.timeText, { color: theme.text }]}>{formatTime(activity.startTime)}</Text>
        </TouchableOpacity>
        {activity.startTime && (
          <TouchableOpacity 
            onPress={() => onTimeChange('', false)} 
            style={styles.removeTimeIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={16} color={theme.icon} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => openPicker(true)} style={[styles.timeButton, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <Text style={[styles.timeText, { color: theme.text }]}>{formatTime(activity.endTime)}</Text>
        </TouchableOpacity>
        {activity.endTime && (
          <TouchableOpacity 
            onPress={() => onTimeChange('', true)} 
            style={styles.removeTimeIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={16} color={theme.icon} />
          </TouchableOpacity>
        )}
      </View>
      
      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker
          value={selectedTime}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={handleTimeChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal
          visible={showPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={handleCancel}
        >
          <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { backgroundColor: theme.surface }]}>
              <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
                <TouchableOpacity onPress={handleCancel} style={[styles.headerButton, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Ionicons name="close" size={24} color={theme.text} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: theme.text }]}>
                  {isEndTimePicker ? "Sélectionner l'heure de fin" : "Sélectionner l'heure de début"}
                </Text>
                <TouchableOpacity onPress={handleConfirm} style={[styles.headerButton, { backgroundColor: theme.background, borderColor: theme.border }]}>
                  <Ionicons name="checkmark" size={24} color={theme.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.pickerContainer}>
                <DateTimePicker
                  value={selectedTime}
                  mode="time"
                  is24Hour={true}
                  display="spinner"
                  onChange={handleTimeChange}
                  style={styles.picker}
                />
              </View>
              {getCurrentTime() && (
                <TouchableOpacity onPress={handleRemove} style={styles.removeTimeButton}>
                  <Ionicons name="trash-outline" size={18} color="#FF3B30" />
                  <Text style={styles.removeTimeText}>Supprimer l'heure</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Modal>
      )}

      <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
        <Ionicons name="close-circle" size={20} color="#FF3B30" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityName: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 4,
  },
  activityAddress: {
    fontSize: 14,
  },
  timeButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  removeTimeIconButton: {
    padding: 2,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  removeButton: {
    padding: 4,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: darkColorWithAlpha(0.5),
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  pickerContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  picker: {
    height: 200,
    width: '100%',
  },
  removeTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: '#FFF5F5',
    gap: 8,
  },
  removeTimeText: {
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '500',
  },
  fallbackContainer: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

