import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Text,
  TouchableWithoutFeedback,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { createPlan, updatePlan, getAllPlacesSummary, type PlaceSummary } from '@/lib/api';
import { Plan } from '@/types/api';
import PlacesPickerModal from './PlacesPickerModal';
import ActivityRow from './ActivityRow';
import { darkColor } from '@/constants/theme';

interface PlanFormProps {
  plan: Plan | null; // null = nouveau plan, sinon = édition
  initialDate?: string; // Date initiale au format YYYY-MM-DD (pour nouveau plan)
  onClose: () => void;
  onSave: () => void;
}

interface PlanActivity {
  placeId: string;
  order: number;
  startTime?: string;
  endTime?: string;
  notes?: string;
  place?: PlaceSummary;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75; // 75% de la hauteur de l'écran

export default function PlanForm({ plan, initialDate, onClose, onSave }: PlanFormProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(500);
  const opacity = useSharedValue(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const getInitialDate = () => {
    if (plan) {
      return new Date(plan.date);
    }
    if (initialDate) {
      return new Date(initialDate);
    }
    return new Date();
  };
  const [date, setDate] = useState<Date>(getInitialDate());
  const [notes, setNotes] = useState(plan?.notes || '');
  const [activities, setActivities] = useState<PlanActivity[]>(
    plan?.activities.map((a) => ({
      placeId: a.placeId,
      order: a.order,
      startTime: a.startTime || undefined,
      endTime: a.endTime || undefined,
      notes: a.notes || undefined,
      place: a.place,
    })) || []
  );
  
  // Places selection
  const [availablePlaces, setAvailablePlaces] = useState<PlaceSummary[]>([]);
  const [showPlacesPicker, setShowPlacesPicker] = useState(false);

  useEffect(() => {
    loadPlaces();
    translateY.value = withTiming(0, { duration: 300 });
    opacity.value = withTiming(1, { duration: 300 });
  }, [plan]);

  const loadPlaces = async () => {
    try {
      setIsLoading(true);
      const response = await getAllPlacesSummary();
      setAvailablePlaces(response.places);
    } catch (error) {
      console.error('Erreur lors du chargement des places:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addActivity = () => {
    setShowPlacesPicker(true);
  };

  const selectPlace = (place: PlaceSummary) => {
    const newActivity: PlanActivity = {
      placeId: place.id,
      order: activities.length,
      place,
    };
    setActivities([...activities, newActivity]);
    setShowPlacesPicker(false);
  };

  const removeActivity = (index: number) => {
    const newActivities = activities
      .filter((_, i) => i !== index)
      .map((a, i) => ({ ...a, order: i }));
    setActivities(newActivities);
  };

  // Fonction pour ajouter/soustraire des heures à une heure string (HH:mm)
  const addHours = (timeString: string, hours: number): string => {
    // Vérifier que le format est valide (HH:mm)
    if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) {
      return timeString; // Retourner tel quel si invalide
    }
    
    const [h, m] = timeString.split(':').map(Number);
    // Vérifier que les valeurs sont valides
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
      return timeString; // Retourner tel quel si invalide
    }
    
    const date = new Date();
    date.setHours(h, m, 0, 0);
    date.setHours(date.getHours() + hours);
    const newHours = date.getHours().toString().padStart(2, '0');
    const newMinutes = date.getMinutes().toString().padStart(2, '0');
    return `${newHours}:${newMinutes}`;
  };

  const updateActivityTime = (index: number, time: string, isEndTime: boolean = false) => {
    const newActivities = [...activities];
    
    // Si time est vide, on supprime simplement l'heure sans calculer l'autre
    if (!time || time.trim() === '') {
      if (isEndTime) {
        newActivities[index].endTime = undefined;
      } else {
        newActivities[index].startTime = undefined;
      }
      setActivities(newActivities);
      return;
    }
    
    // Vérifier que le format est valide avant de continuer
    if (!/^\d{2}:\d{2}$/.test(time)) {
      // Format invalide, ne rien faire
      return;
    }
    
    if (isEndTime) {
      // Si on définit l'heure de fin
      newActivities[index].endTime = time;
      // Si l'heure de départ est null ou vide, la définir à -1 heure
      if (!newActivities[index].startTime || newActivities[index].startTime.trim() === '') {
        const calculatedStartTime = addHours(time, -1);
        // Vérifier que le résultat est valide avant de l'assigner
        if (/^\d{2}:\d{2}$/.test(calculatedStartTime)) {
          newActivities[index].startTime = calculatedStartTime;
        }
      }
    } else {
      // Si on définit l'heure de départ
      newActivities[index].startTime = time;
      // Si l'heure de fin est null ou vide, la définir à +1 heure
      if (!newActivities[index].endTime || newActivities[index].endTime.trim() === '') {
        const calculatedEndTime = addHours(time, 1);
        // Vérifier que le résultat est valide avant de l'assigner
        if (/^\d{2}:\d{2}$/.test(calculatedEndTime)) {
          newActivities[index].endTime = calculatedEndTime;
        }
      }
    }
    
    setActivities(newActivities);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const firstActivity = activities[0];
      const planTitle = firstActivity?.place?.placeName || 
                       firstActivity?.place?.rawTitle || 
                       undefined;
      
      const planData = {
        date: date.toISOString().split('T')[0],
        title: planTitle || undefined,
        notes: notes || undefined,
        activities: activities.map((a) => ({
          placeId: a.placeId,
          order: a.order,
          startTime: a.startTime && a.startTime.trim() !== '' && /^\d{2}:\d{2}$/.test(a.startTime) ? a.startTime : undefined,
          endTime: a.endTime && a.endTime.trim() !== '' && /^\d{2}:\d{2}$/.test(a.endTime) ? a.endTime : undefined,
          notes: a.notes,
        })),
      };

      if (plan) {
        await updatePlan(plan.id, planData);
      } else {
        await createPlan(planData);
      }

      onSave();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du plan:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const panGesture = Gesture.Pan()
    .activeOffsetY(10) // Activer le geste après 10px de déplacement vertical
    .onStart(() => {
      'worklet';
      // Sauvegarder la position initiale
    })
    .onUpdate((event) => {
      'worklet';
      // Permettre de glisser uniquement vers le bas (fermer)
      if (event.translationY > 0) {
        translateY.value = event.translationY;
        // Réduire l'opacité progressivement
        const progress = Math.min(event.translationY / 200, 1);
        opacity.value = 1 - progress * 0.5;
      }
    })
    .onEnd((event) => {
      'worklet';
      // Si on a glissé assez loin ou avec assez de vitesse, fermer
      if (event.translationY > 100 || event.velocityY > 500) {
        translateY.value = withTiming(500, { duration: 300 }, () => {
          runOnJS(onClose)();
        });
        opacity.value = withTiming(0, { duration: 300 });
      } else {
        // Sinon, revenir à la position initiale
        translateY.value = withTiming(0, { duration: 200 });
        opacity.value = withTiming(1, { duration: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.5,
  }));

  return (
    <>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
      </Animated.View>

      <Animated.View
        style={[
          styles.sheet,
          {
            paddingBottom: insets.bottom,
            height: SHEET_HEIGHT,
          },
          animatedStyle,
        ]}
      >
        <GestureDetector gesture={panGesture}>
          <View style={styles.dragArea}>
            <View style={styles.handle} />
            
            {/* Header */}
            <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={24} color={darkColor} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouveau</Text>
          <TouchableOpacity 
            onPress={handleSave} 
            style={styles.headerButton}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={darkColor} />
            ) : (
              <Ionicons name="checkmark" size={24} color={darkColor} />
            )}
          </TouchableOpacity>
        </View>
          </View>
        </GestureDetector>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Activités */}
          {activities.length > 0 && (
            <View style={styles.section}>
              {activities.map((activity, index) => (
                <ActivityRow
                  key={index}
                  activity={activity}
                  onTimeChange={(time, isEndTime) => updateActivityTime(index, time, isEndTime)}
                  onRemove={() => removeActivity(index)}
                />
              ))}
            </View>
          )}

          {/* Ajouter une activité */}
          <TouchableOpacity style={styles.row} onPress={addActivity}>
            <Text style={styles.rowLabel}>Ajouter un lieu</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          {/* Notes */}
          <View style={styles.notesSection}>
            <Text style={styles.notesLabel}>Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Ajoutez des notes..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
            />
          </View>
        </ScrollView>

        {/* Places Picker Modal */}
        <PlacesPickerModal
          visible={showPlacesPicker}
          places={availablePlaces}
          selectedPlaceIds={activities.map((a) => a.placeId)}
          onPlaceSelect={selectPlace}
          onClose={() => setShowPlacesPicker(false)}
            />
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: darkColor,
    zIndex: 999,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 1000,
    shadowColor: darkColor,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
    flexDirection: 'column',
  },
  dragArea: {
    width: '100%',
    paddingTop: 8,
    paddingBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#CCC',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: darkColor,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  rowLabel: {
    fontSize: 16,
    color: darkColor,
    fontWeight: '400',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    fontSize: 16,
    color: darkColor,
    fontWeight: '400',
  },
  rowPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  section: {
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  notesSection: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  notesLabel: {
    fontSize: 16,
    color: darkColor,
    fontWeight: '400',
    marginBottom: 8,
  },
  notesInput: {
    fontSize: 16,
    color: darkColor,
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
