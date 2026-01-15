import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { type PlanActivity } from '@/lib/api';
import { darkColor } from '@/constants/theme';

interface EventCardProps {
  activity: PlanActivity;
  onPress: () => void;
  height?: number; // Hauteur calculée selon la durée
}

export default function EventCard({ activity, onPress, height }: EventCardProps) {
  return (
    <TouchableOpacity 
      style={[styles.eventCard, height ? { height } : undefined]} 
      onPress={onPress} 
      activeOpacity={0.7}
    >
      <View style={styles.eventHeader}>
        <Text style={styles.eventTime}>
          {activity.startTime && activity.endTime
            ? `${activity.startTime} - ${activity.endTime}`
            : activity.startTime || activity.endTime || '00:00'}
        </Text>
        {activity.order > 0 && (
          <View style={styles.orderBadge}>
            <Text style={styles.orderText}>{activity.order + 1}</Text>
          </View>
        )}
      </View>
      <Text style={styles.eventName}>
        {activity.place?.placeName || activity.place?.rawTitle || 'Lieu sans nom'}
      </Text>
      {activity.place?.googleFormattedAddress && (
        <Text style={styles.eventAddress} numberOfLines={1}>
          {activity.place.googleFormattedAddress}
        </Text>
      )}
      {activity.notes && (
        <Text style={styles.eventNotes} numberOfLines={2}>
          {activity.notes}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  eventCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: darkColor,
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 12,
    fontWeight: '600',
    color: darkColor,
  },
  orderBadge: {
    backgroundColor: darkColor,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orderText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    color: darkColor,
    marginBottom: 4,
  },
  eventAddress: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  eventNotes: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
});

