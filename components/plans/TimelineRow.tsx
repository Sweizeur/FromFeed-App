import React from 'react';
import { View, StyleSheet, Text, Pressable } from 'react-native';
import EventCard from './EventCard';
import { type PlanActivity } from '@/lib/api';

interface TimelineRowProps {
  hour: string;
  activities: PlanActivity[];
  onEventPress: (activity: PlanActivity) => void;
}

export default function TimelineRow({ hour, activities, onEventPress }: TimelineRowProps) {
  const hourNumber = parseInt(hour.split(':')[0]);
  const displayHour = hourNumber.toString().padStart(2, '0') + ':00';

  return (
    <Pressable style={styles.timelineRow} onPress={() => {}}>
      <View style={styles.timeColumn}>
        <Text style={styles.timeText}>{displayHour}</Text>
      </View>
      <View style={styles.eventsColumn}>
        {activities.length > 0 ? (
          activities.map((activity) => (
            <EventCard key={activity.id} activity={activity} onPress={() => onEventPress(activity)} />
          ))
        ) : (
          <View style={styles.emptyHour}>
            <View style={styles.hourLine} />
          </View>
        )}
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

