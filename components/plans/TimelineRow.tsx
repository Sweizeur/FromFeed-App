import React from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import EventCard from './EventCard';
import { type PlanActivity } from '@/lib/api';

interface TimelineRowProps {
  hour: string;
  activities: PlanActivity[];
  onEventPress: (activity: PlanActivity) => void;
}

// Fonction pour calculer la durée en heures
const calculateDurationInHours = (startTime: string, endTime: string | null | undefined): number => {
  if (!endTime) return 1; // Par défaut 1 heure si pas d'heure de fin
  
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  
  const durationMinutes = endMinutes - startMinutes;
  // Arrondir à l'heure supérieure pour l'affichage
  return Math.max(1, Math.ceil(durationMinutes / 60));
};

// Fonction pour obtenir l'heure de début d'une activité
const getStartHour = (startTime: string): string => {
  const hour = parseInt(startTime.split(':')[0]);
  return `${hour.toString().padStart(2, '0')}:00`;
};

export default function TimelineRow({ hour, activities, onEventPress }: TimelineRowProps) {
  const hourNumber = parseInt(hour.split(':')[0]);
  const displayHour = hourNumber.toString().padStart(2, '0') + ':00';
  
  // Filtrer les activités qui commencent à cette heure (pas celles qui s'étendent)
  const activitiesStartingHere = activities.filter((activity) => {
    if (!activity.startTime) return false;
    const activityStartHour = getStartHour(activity.startTime);
    return activityStartHour === hour;
  });

  return (
    <Pressable style={styles.timelineRow} onPress={() => {}}>
      <View style={styles.timeColumn}>
        <Text style={styles.timeText}>{displayHour}</Text>
      </View>
      <View style={styles.eventsColumn}>
        {/* Ne plus afficher les événements ici, ils sont positionnés de manière absolue dans le parent */}
          <View style={styles.emptyHour}>
            <View style={styles.hourLine} />
          </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  timelineRow: {
    flexDirection: 'row',
    minHeight: 60,
    marginBottom: 8,
    width: '100%',
    overflow: 'visible',
  },
  timeColumn: {
    width: 60,
    paddingTop: 4,
    alignItems: 'flex-end',
    paddingRight: 12,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  eventsColumn: {
    flex: 1,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#E0E0E0',
    position: 'relative',
    minHeight: 60,
  },
  emptyHour: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 4,
    minHeight: 60,
  },
  hourLine: {
    height: 1,
    backgroundColor: '#E0E0E0',
  },
});

