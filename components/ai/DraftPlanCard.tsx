import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { darkColor } from '@/constants/theme';

interface DraftPlanActivity {
  placeName: string;
  placeId: string;
  order: number;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

interface DraftPlan {
  date: string;
  title: string | null;
  notes: string | null;
  activities: DraftPlanActivity[];
  isValidated?: boolean;
}

interface DraftPlanCardProps {
  draftPlan: DraftPlan;
  onValidate: () => void;
  onReject: () => void;
}

export default function DraftPlanCard({ draftPlan, onValidate, onReject }: DraftPlanCardProps) {
  const isValidated = draftPlan.isValidated === true;

  return (
    <>
      <View style={styles.draftPlanContainer}>
        <Text style={styles.draftPlanTitle}>
          {draftPlan.title || 'Plan proposé'}
        </Text>
        {draftPlan.date && (
          <Text style={styles.draftPlanDate}>
            Date: {draftPlan.date}
          </Text>
        )}
        {draftPlan.notes && (
          <Text style={styles.draftPlanNotes}>
            {draftPlan.notes}
          </Text>
        )}
        <View style={styles.draftPlanActivities}>
          {draftPlan.activities.map((activity, index) => (
            <View 
              key={index} 
              style={[
                styles.draftPlanActivity,
                index === draftPlan.activities.length - 1 && styles.draftPlanActivityLast
              ]}
            >
              <Text style={styles.draftPlanActivityName}>
                {activity.order + 1}. {activity.placeName}
              </Text>
              {(activity.startTime || activity.endTime) && (
                <Text style={styles.draftPlanActivityTime}>
                  {activity.startTime && activity.endTime 
                    ? `${activity.startTime} - ${activity.endTime}`
                    : activity.startTime || activity.endTime}
                </Text>
              )}
              {activity.notes && (
                <Text style={styles.draftPlanActivityNotes}>
                  {activity.notes}
                </Text>
              )}
            </View>
          ))}
        </View>
      </View>
      {!isValidated && (
        <View style={styles.draftPlanActions}>
          <TouchableOpacity
            style={styles.draftPlanButton}
            onPress={onReject}
          >
            <Ionicons name="close" size={22} color={darkColor} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.draftPlanButton}
            onPress={onValidate}
          >
            <Ionicons name="checkmark" size={22} color={darkColor} />
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  draftPlanContainer: {
    marginTop: 12,
    padding: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  draftPlanTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: darkColor,
    marginBottom: 8,
  },
  draftPlanDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  draftPlanNotes: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  draftPlanActivities: {
    marginTop: 8,
    marginBottom: 16,
  },
  draftPlanActivity: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  draftPlanActivityLast: {
    borderBottomWidth: 0,
  },
  draftPlanActivityName: {
    fontSize: 15,
    fontWeight: '600',
    color: darkColor,
    marginBottom: 4,
  },
  draftPlanActivityTime: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  draftPlanActivityNotes: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
  },
  draftPlanActions: {
    flexDirection: 'row',
    marginTop: 8,
    justifyContent: 'flex-end',
  },
  draftPlanButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -4,
  },
});

