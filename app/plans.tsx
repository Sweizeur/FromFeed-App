import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import BottomNav from '@/components/navigation/BottomNav';
import PlanForm from '@/components/plans/PlanForm';
import TimelineRow from '@/components/plans/TimelineRow';
import { getPlans, type Plan, type PlanActivity } from '@/lib/api';
import { darkColor } from '@/constants/theme';

interface PlansScreenProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

// Les activités du plan incluent déjà la place via PlanActivity.place

export default function PlansScreen({ activeTab: propActiveTab, onTabChange: propOnTabChange }: PlansScreenProps = {}) {
  const insets = useSafeAreaInsets();
  const [internalActiveTab, setInternalActiveTab] = useState('plans');
  const activeTab = propActiveTab ?? internalActiveTab;
  const setActiveTab = propOnTabChange ?? setInternalActiveTab;
  
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0] // Format YYYY-MM-DD
  );
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(false);
  const [actualCalendarHeight, setActualCalendarHeight] = useState(340);
  const [isAnimating, setIsAnimating] = useState(false);
  const calendarHeight = useSharedValue(340);

  // Charger les plans
  const loadPlans = async () => {
    try {
      setLoading(true);
      const response = await getPlans();
      setPlans(response.plans || []);
    } catch (error) {
      console.error('[PlansScreen] Erreur lors du chargement des plans:', error);
      setPlans([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  // Générer les heures de la journée (00:00 à 23:00)
  const hours = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return `${hour}:00`;
  });

  // Trouver le plan pour la date sélectionnée
  useEffect(() => {
    const planForDate = plans.find((plan) => {
      const planDate = new Date(plan.date).toISOString().split('T')[0];
      return planDate === selectedDate;
    });
    setSelectedPlan(planForDate || null);
  }, [selectedDate, plans]);

  // Séparer les activités avec heure et sans heure
  const activitiesWithTime: PlanActivity[] = [];
  const activitiesWithoutTime: PlanActivity[] = [];
  const activitiesByHour: Record<string, PlanActivity[]> = {};
  
  if (selectedPlan) {
    selectedPlan.activities.forEach((activity) => {
      if (activity.startTime && activity.startTime.trim() !== '') {
        // Activité avec heure
        activitiesWithTime.push(activity);
        const hour = activity.startTime.split(':')[0] + ':00';
        if (!activitiesByHour[hour]) {
          activitiesByHour[hour] = [];
        }
        activitiesByHour[hour].push(activity);
      } else {
        // Activité sans heure (toute la journée)
        activitiesWithoutTime.push(activity);
      }
    });
  }

  // Scroller automatiquement vers le premier événement (avec heure uniquement)
  useEffect(() => {
    if (scrollViewHeight > 0 && activitiesWithTime.length > 0 && scrollViewRef.current) {
      // Trouver la première activité avec heure
      const firstActivity = activitiesWithTime
        .sort((a, b) => {
          const timeA = a.startTime || '';
          const timeB = b.startTime || '';
          return timeA.localeCompare(timeB);
        })[0];

      if (firstActivity && firstActivity.startTime) {
        const hour = firstActivity.startTime.split(':')[0] + ':00';
        const hourIndex = hours.indexOf(hour);

        if (hourIndex >= 0) {
          // Calculer la position Y (chaque ligne fait environ 68px : minHeight 60 + marginBottom 8)
          const rowHeight = 68;
          const scrollPosition = hourIndex * rowHeight;

          // Attendre un peu pour que le ScrollView soit complètement rendu
          setTimeout(() => {
            scrollViewRef.current?.scrollTo({
              y: Math.max(0, scrollPosition - 20), // -20 pour un peu de padding en haut
              animated: true,
            });
          }, 100);
        }
      }
    }
  }, [scrollViewHeight, selectedPlan, selectedDate, hours, activitiesWithTime]);

  const onDayPress = (day: { dateString: string }) => {
    setSelectedDate(day.dateString);
  };

  const handleAddEvent = () => {
    // Si un plan existe déjà pour cette date, on l'édite, sinon on crée un nouveau plan
    const existingPlan = plans.find((plan) => {
      const planDate = new Date(plan.date).toISOString().split('T')[0];
      return planDate === selectedDate;
    });
    
    if (existingPlan) {
      setEditingPlan(existingPlan);
    } else {
      setEditingPlan(null);
    }
    setIsFormVisible(true);
  };

  const handleFormClose = async () => {
    setIsFormVisible(false);
    setEditingPlan(null);
    await loadPlans(); // Recharger les plans après sauvegarde
  };

  const handleEventPress = (activity: PlanActivity) => {
    // Optionnel : permettre d'éditer une activité spécifique
    // Pour l'instant, on ouvre le formulaire pour éditer le plan entier
    if (selectedPlan) {
      setEditingPlan(selectedPlan);
      setIsFormVisible(true);
    }
  };

  // Marquer les dates qui ont des plans avec au moins une activité
  const markedDates: Record<string, { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string }> = {};
  plans.forEach((plan) => {
    // Ne marquer que les plans qui ont au moins une activité
    if (plan.activities && plan.activities.length > 0) {
    const planDate = new Date(plan.date).toISOString().split('T')[0];
    if (!markedDates[planDate]) {
      markedDates[planDate] = { marked: true, dotColor: darkColor };
      }
    }
  });
  
  // Ajouter la sélection
  markedDates[selectedDate] = {
    ...markedDates[selectedDate],
    selected: true,
    selectedColor: darkColor,
  };

  const handleCalendarLayout = (event: any) => {
    // Ne pas mettre à jour pendant l'animation pour éviter les conflits
    if (isAnimating) return;
    
    if (!isCalendarCollapsed) {
      const { height } = event.nativeEvent.layout;
      // La hauteur mesurée est celle du calendarInner qui contient le Calendar
      // On ajoute la hauteur du header (44px) + padding vertical du wrapper (16px)
      const headerHeight = 44;
      const wrapperPaddingVertical = 16; // paddingTop + paddingBottom du calendarWrapper
      const totalHeight = height + headerHeight + wrapperPaddingVertical;
      setActualCalendarHeight(totalHeight);
      // Mettre à jour directement sans animation pour éviter les conflits
      // L'animation sera gérée uniquement par le bouton collapse/expand
      calendarHeight.value = totalHeight;
    }
  };

  const handleTimelineContainerLayout = (event: any) => {
    const { height } = event.nativeEvent.layout;
    const titleHeight = 60; // Hauteur approximative du titre
    setScrollViewHeight(height - titleHeight);
  };

  const animatedCalendarStyle = useAnimatedStyle(() => ({
    height: calendarHeight.value,
    opacity: calendarHeight.value > 60 ? 1 : 0,
    overflow: 'hidden',
  }), []);

  // Réinitialiser la hauteur du calendrier quand la date change (pour recalculer)
  useEffect(() => {
    if (!isCalendarCollapsed) {
      // Utiliser la hauteur actuelle mesurée, ou une valeur par défaut si pas encore mesurée
      calendarHeight.value = actualCalendarHeight || 340;
      // Le onLayout du Calendar va mettre à jour la vraie hauteur si elle change
    }
  }, [selectedDate]);

  return (
    <View style={[styles.container, { flex: 1, paddingTop: propActiveTab ? insets.top : insets.top }]}>
      {/* Calendrier */}
      <View style={[styles.calendarWrapper, isCalendarCollapsed && styles.calendarWrapperCollapsed]}>
          <TouchableOpacity 
          style={styles.calendarHeader}
          onPress={() => {
            const newCollapsedState = !isCalendarCollapsed;
            setIsCalendarCollapsed(newCollapsedState);
            setIsAnimating(true);
            // Utiliser la hauteur mesurée ou une valeur par défaut si pas encore mesurée
            const targetHeight = newCollapsedState ? 0 : (actualCalendarHeight || 340);
            calendarHeight.value = withTiming(targetHeight, { duration: 300 }, (finished) => {
              'worklet';
              if (finished) {
                runOnJS(setIsAnimating)(false);
              }
            });
          }}
            activeOpacity={0.7}
          >
          <Text style={styles.calendarHeaderText}>
            {new Date(selectedDate).toLocaleDateString('fr-FR', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
          <Ionicons
            name={isCalendarCollapsed ? 'chevron-down' : 'chevron-up'}
            size={20}
            color={darkColor}
          />
          </TouchableOpacity>
        <Animated.View style={[styles.calendarContainer, animatedCalendarStyle]}>
          <View 
            style={styles.calendarInner}
            onLayout={handleCalendarLayout}
          >
            {!isCalendarCollapsed && (
          <Calendar
            current={selectedDate}
            onDayPress={onDayPress}
            markedDates={markedDates}
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
            )}
          </View>
        </Animated.View>
        </View>

      {/* Timeline avec flex: 1 pour prendre tout l'espace restant */}
      <View 
        style={styles.timelineContainer}
        onLayout={handleTimelineContainerLayout}
      >
        <View style={styles.timelineHeader}>
          <Text style={styles.timelineTitle}>
            {new Date(selectedDate).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </Text>
          {selectedPlan && selectedPlan.activities.length > 0 ? (
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => {
                setEditingPlan(selectedPlan);
                setIsFormVisible(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={20} color={darkColor} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.editButton}
              onPress={handleAddEvent}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={20} color={darkColor} />
            </TouchableOpacity>
          )}
        </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={darkColor} />
            </View>
          ) : selectedPlan && selectedPlan.activities.length > 0 ? (
          <>
            {/* Événements sans heure */}
            {activitiesWithoutTime.length > 0 && (
              <View style={styles.allDayEventsContainer}>
                {activitiesWithoutTime.map((activity) => (
                          <TouchableOpacity 
                            key={activity.id} 
                    style={styles.allDayEventCard}
                            onPress={() => handleEventPress(activity)}
                            activeOpacity={0.7}
                          >
                    <Text style={styles.allDayEventName} numberOfLines={1}>
                      {activity.place?.placeName || activity.place?.rawTitle || 'Lieu sans nom'}
                            </Text>
                            {activity.place?.googleFormattedAddress && (
                      <Text style={styles.allDayEventAddress} numberOfLines={1}>
                                {activity.place.googleFormattedAddress}
                              </Text>
                            )}
                            {activity.notes && (
                      <Text style={styles.allDayEventNotes} numberOfLines={1}>
                                {activity.notes}
                              </Text>
                            )}
                          </TouchableOpacity>
                ))}
                        </View>
                      )}
            
            {/* Timeline avec événements horaires */}
            {scrollViewHeight > 0 && (
              <ScrollView 
                ref={scrollViewRef}
                style={[styles.timelineScroll, { height: scrollViewHeight }]} 
                contentContainerStyle={styles.timelineScrollContent}
                showsVerticalScrollIndicator={true}
                bounces={true}
                scrollEnabled={true}
                nestedScrollEnabled={false}
              >
                {hours.map((hour) => {
                  const activities = activitiesByHour[hour] || [];
                  return (
                    <TimelineRow
                      key={hour}
                      hour={hour}
                      activities={activities}
                      onEventPress={handleEventPress}
                    />
                );
              })}
            </ScrollView>
            )}
          </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Aucun plan pour ce jour</Text>
              <Text style={styles.emptySubtext}>
                Créez un plan pour organiser votre journée
              </Text>
            </View>
          )}
      </View>

      {/* Formulaire de création/édition de plan */}
      {isFormVisible && (
        <PlanForm
          plan={editingPlan || null}
          initialDate={editingPlan ? undefined : selectedDate}
          onClose={handleFormClose}
          onSave={handleFormClose}
        />
      )}

      {!propActiveTab && <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    minHeight: 56,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: darkColor,
  },
  addButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarWrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  calendarWrapperCollapsed: {
    paddingBottom: 4,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    marginBottom: 8,
    minHeight: 44,
  },
  calendarHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: darkColor,
    textTransform: 'capitalize',
  },
  calendarContainer: {
    overflow: 'hidden',
    paddingHorizontal: 0,
  },
  calendarInner: {
    // minHeight supprimé pour permettre la mesure dynamique
  },
  calendar: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    padding: 8,
  },
  timelineContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 0,
    minHeight: 0,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timelineTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: darkColor,
    textTransform: 'capitalize',
    flex: 1,
  },
  editButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  timelineScroll: {
    width: '100%',
  },
  timelineScrollContent: {
    paddingBottom: 100,
  },
  allDayEventsContainer: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  allDayEventCard: {
    backgroundColor: '#F8F8F8',
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
    borderLeftWidth: 2,
    borderLeftColor: '#999',
  },
  allDayEventName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginBottom: 2,
  },
  allDayEventAddress: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  allDayEventNotes: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: darkColor,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
