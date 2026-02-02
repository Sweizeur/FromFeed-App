import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, ScrollView, ActivityIndicator, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomNav from '@/components/navigation/BottomNav';
import PlanForm from '@/components/plans/PlanForm';
import TimelineRow from '@/components/plans/TimelineRow';
import EventCard from '@/components/plans/EventCard';
import { getPlans, type Plan, type PlanActivity } from '@/lib/api';
import { exportPlanToCalendar } from '@/lib/calendar-export';
import { darkColor } from '@/constants/theme';

const PLANS_CACHE_KEY = '@fromfeed:plans_cache';
const CLIENT_CACHE_DURATION = 30 * 1000; // 30 secondes

// Cache client en mémoire pour éviter les requêtes multiples
let plansClientCache: {
  data: Plan[];
  timestamp: number;
} | null = null;
let isLoadingPlansRef = false;

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
  
  // Initialiser avec le cache client si disponible (évite l'effet de reload)
  const [plans, setPlans] = useState<Plan[]>(() => {
    // Vérifier le cache client en mémoire d'abord
    if (plansClientCache && (Date.now() - plansClientCache.timestamp) < CLIENT_CACHE_DURATION) {
      return plansClientCache.data;
    }
    // Sinon, essayer AsyncStorage (synchrone via une fonction helper)
    return [];
  });
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isFormVisible, setIsFormVisible] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [scrollViewHeight, setScrollViewHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [isCalendarCollapsed, setIsCalendarCollapsed] = useState(false);
  const [actualCalendarHeight, setActualCalendarHeight] = useState(340);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isExportingToCalendar, setIsExportingToCalendar] = useState(false);
  const calendarHeight = useSharedValue(340);

  // Charger les plans depuis le cache au montage
  useEffect(() => {
    loadCachedPlans();
  }, []);

  // Charger les plans depuis le cache
  const loadCachedPlans = async () => {
    // Si on a déjà des plans (depuis le cache client), vérifier si on doit recharger
    if (plans.length > 0) {
      // Vérifier si le cache est encore valide
      if (plansClientCache && (Date.now() - plansClientCache.timestamp) < CLIENT_CACHE_DURATION) {
        // Cache encore valide, ne pas recharger
        return;
      }
      // Cache expiré, recharger en arrière-plan
      loadPlansInBackground().catch(() => {});
      return;
    }

    // Vérifier le cache client en mémoire
    if (plansClientCache && (Date.now() - plansClientCache.timestamp) < CLIENT_CACHE_DURATION) {
      console.log('[PlansScreen] Utilisation du cache client');
      setPlans(plansClientCache.data);
      // Ne PAS recharger si le cache est encore valide (évite les requêtes inutiles)
      return;
    }

    // Sinon, utiliser AsyncStorage
    try {
      const cachedData = await AsyncStorage.getItem(PLANS_CACHE_KEY);
      if (cachedData) {
        const cachedPlans = JSON.parse(cachedData);
        setPlans(cachedPlans);
      }
    } catch (error) {
      __DEV__ && console.error('[PlansScreen] Erreur lors du chargement du cache:', error);
    }
    // Charger en arrière-plan après avoir affiché le cache
    loadPlansInBackground();
  };

  // Charger les plans depuis l'API en arrière-plan (sans loader)
  const loadPlansInBackground = async () => {
    // Éviter les requêtes simultanées multiples
    if (isLoadingPlansRef) {
      console.log('[PlansScreen] Requête déjà en cours, skip...');
      return;
    }

    try {
      isLoadingPlansRef = true;
      const response = await getPlans();
      const plansData = response.plans || [];
      // Mettre à jour immédiatement l'affichage
      setPlans(plansData);
      // Sauvegarder dans le cache AsyncStorage
      await AsyncStorage.setItem(PLANS_CACHE_KEY, JSON.stringify(plansData));
      // Mettre à jour le cache client
      plansClientCache = {
        data: plansData,
        timestamp: Date.now(),
      };
    } catch (error) {
      __DEV__ && console.error('[PlansScreen] Erreur lors du chargement des plans:', error);
    } finally {
      isLoadingPlansRef = false;
    }
  };

  // Fonction pour recharger les plans (utilisée après sauvegarde)
  const loadPlans = async () => {
    await loadPlansInBackground();
  };

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
  // Calculer la durée et les heures couvertes par chaque activité
  const activitiesWithTime: PlanActivity[] = [];
  const activitiesWithoutTime: PlanActivity[] = [];
  const activitiesByHour: Record<string, PlanActivity[]> = {};
  
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
  
  // Fonction pour obtenir toutes les heures couvertes par une activité
  const getHoursForActivity = (activity: PlanActivity): string[] => {
    if (!activity.startTime || activity.startTime.trim() === '') return [];
    
    const startHour = parseInt(activity.startTime.split(':')[0]);
    const duration = calculateDurationInHours(activity.startTime, activity.endTime || null);
    const hours: string[] = [];
    
    for (let i = 0; i < duration; i++) {
      const hour = (startHour + i) % 24;
      hours.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    
    return hours;
  };
  
  if (selectedPlan) {
    selectedPlan.activities.forEach((activity) => {
      if (activity.startTime && activity.startTime.trim() !== '') {
        // Activité avec heure
        activitiesWithTime.push(activity);
        // Ajouter l'activité à toutes les heures qu'elle couvre
        const hours = getHoursForActivity(activity);
        hours.forEach((hour) => {
        if (!activitiesByHour[hour]) {
          activitiesByHour[hour] = [];
        }
          // Ne pas dupliquer l'activité si elle est déjà dans cette heure
          if (!activitiesByHour[hour].find(a => a.id === activity.id)) {
        activitiesByHour[hour].push(activity);
          }
        });
      } else {
        // Activité sans heure (toute la journée)
        activitiesWithoutTime.push(activity);
      }
    });
  }

  // Fonction pour calculer les positions des événements avec superposition
  const calculateEventPositions = () => {
    interface EventPosition {
      activity: PlanActivity;
      top: number;
      height: number;
      bottom: number;
      left: number;
      width: number;
      zIndex: number;
      stackIndex: number;
      isDot?: boolean; // Si true, afficher un point au lieu de l'événement complet
      dotGroup?: PlanActivity[]; // Les activités du groupe pour le point
    }

    const eventPositions: EventPosition[] = [];
    const LEFT_OFFSET = 72; // 60px (timeColumn) + 12px (paddingLeft)
    const RIGHT_OFFSET = 16;
    const SCREEN_WIDTH = Dimensions.get('window').width;
    const PADDING_HORIZONTAL = 16; // paddingHorizontal du timelineContainer
    const AVAILABLE_WIDTH = SCREEN_WIDTH - LEFT_OFFSET - RIGHT_OFFSET - PADDING_HORIZONTAL;

    // Calculer les positions de base pour chaque événement
    activitiesWithTime.forEach((activity) => {
      if (!activity.startTime) return;

      const startHour = parseInt(activity.startTime.split(':')[0]);
      const startMin = parseInt(activity.startTime.split(':')[1] || '0');
      
      // Calculer la durée réelle en heures
      let durationInHours = 1;
      if (activity.endTime) {
        const [startHourNum, startMinNum] = activity.startTime.split(':').map(Number);
        const [endHourNum, endMinNum] = activity.endTime.split(':').map(Number);
        const startMinutes = startHourNum * 60 + startMinNum;
        const endMinutes = endHourNum * 60 + endMinNum;
        const durationMinutes = endMinutes - startMinutes;
        durationInHours = durationMinutes / 60;
      }
      
      const top = (startHour * 68) + (startMin / 60) * 68;
      const calculatedHeight = durationInHours * 68 - 8;
      const height = Math.max(80, calculatedHeight);
      const bottom = top + height;

      eventPositions.push({
        activity,
        top,
        height,
        bottom,
        left: LEFT_OFFSET,
        width: AVAILABLE_WIDTH,
        zIndex: 10, // Valeur par défaut
        stackIndex: 0, // Sera calculé plus tard
      });
    });

    // Trier par heure de début (les plus tôt en premier)
    eventPositions.sort((a, b) => a.top - b.top);

    // Fonction pour vérifier si deux événements se chevauchent
    const eventsOverlap = (event1: EventPosition, event2: EventPosition): boolean => {
      return !(event1.bottom <= event2.top || event1.top >= event2.bottom);
    };

    // Fonction pour calculer la différence en minutes entre deux heures de début
    const getStartTimeDifferenceMinutes = (event1: EventPosition, event2: EventPosition): number => {
      const time1 = event1.activity.startTime;
      const time2 = event2.activity.startTime;
      if (!time1 || !time2) return Infinity;
      
      const [hour1, min1] = time1.split(':').map(Number);
      const [hour2, min2] = time2.split(':').map(Number);
      const minutes1 = hour1 * 60 + min1;
      const minutes2 = hour2 * 60 + min2;
      
      return Math.abs(minutes1 - minutes2);
    };

    // Fonction pour vérifier si deux événements commencent à moins de 30 minutes d'écart
    const startsWithin30Minutes = (event1: EventPosition, event2: EventPosition): boolean => {
      return getStartTimeDifferenceMinutes(event1, event2) <= 30;
    };

    // Créer des groupes d'événements qui commencent à moins de 30 minutes d'écart
    const sideBySideGroups: EventPosition[][] = [];
    const processedEvents = new Set<PlanActivity['id']>();

    eventPositions.forEach((currentEvent) => {
      if (processedEvents.has(currentEvent.activity.id)) return;

      // Trouver tous les événements qui commencent à moins de 30 minutes de celui-ci
      const nearbyEvents = [currentEvent];
      eventPositions.forEach((otherEvent) => {
        if (
          otherEvent.activity.id !== currentEvent.activity.id &&
          !processedEvents.has(otherEvent.activity.id) &&
          startsWithin30Minutes(currentEvent, otherEvent)
        ) {
          nearbyEvents.push(otherEvent);
        }
      });

      // Trier les événements du groupe par heure de début
      nearbyEvents.sort((a, b) => a.top - b.top);
      
      // Marquer tous les événements du groupe comme traités
      nearbyEvents.forEach(e => processedEvents.add(e.activity.id));
      
      if (nearbyEvents.length > 1) {
        sideBySideGroups.push(nearbyEvents);
      }
    });

    // Pour chaque événement, calculer sa position
    eventPositions.forEach((currentEvent, currentIndex) => {
      // Vérifier si cet événement fait partie d'un groupe côte à côte
      const sideBySideGroup = sideBySideGroups.find(group => 
        group.some(e => e.activity.id === currentEvent.activity.id)
      );

      if (sideBySideGroup) {
        if (sideBySideGroup.length >= 3) {
          // Pour 3+ événements, afficher des rectangles arrondis côte à côte
          // La largeur sera calculée dans le rendu pour prendre toute la largeur disponible
          currentEvent.isDot = true;
          currentEvent.dotGroup = sideBySideGroup.map(e => e.activity);
          currentEvent.left = LEFT_OFFSET;
          currentEvent.width = AVAILABLE_WIDTH; // Sera utilisé pour le conteneur
          currentEvent.height = 20; // Hauteur du rectangle arrondi
          currentEvent.stackIndex = 0;
        } else {
          // Pour 2 événements, les placer côte à côte
          const groupIndex = sideBySideGroup.findIndex(e => e.activity.id === currentEvent.activity.id);
          const groupSize = sideBySideGroup.length;
          const gap = 2; // Petit espace entre les événements
          const eventWidth = (AVAILABLE_WIDTH - (gap * (groupSize - 1))) / groupSize;
          
          currentEvent.left = LEFT_OFFSET + (groupIndex * (eventWidth + gap));
          currentEvent.width = eventWidth;
          currentEvent.stackIndex = 0; // Pas de superposition pour les événements côte à côte
        }
      } else {
        // Comportement normal : superposition pour les événements qui se chevauchent
        const overlappingPrevious = eventPositions
          .slice(0, currentIndex)
          .filter(e => {
            // Ne pas considérer les événements du même groupe côte à côte
            const eGroup = sideBySideGroups.find(group => 
              group.some(ev => ev.activity.id === e.activity.id)
            );
            return !eGroup && eventsOverlap(currentEvent, e);
          });
        
        if (overlappingPrevious.length > 0) {
          const maxStackIndex = Math.max(...overlappingPrevious.map(e => e.stackIndex));
          currentEvent.stackIndex = maxStackIndex + 1;
        } else {
          currentEvent.stackIndex = 0;
        }
        
        currentEvent.left = LEFT_OFFSET;
        currentEvent.width = AVAILABLE_WIDTH;
      }
      
      // Les événements plus récents (plus tard) ont un z-index plus élevé pour être au-dessus
      currentEvent.zIndex = 10 + currentIndex;
    });

    return eventPositions;
  };

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
    if (selectedPlan) {
      setEditingPlan(selectedPlan);
      setIsFormVisible(true);
    }
  };

  const handleAddToCalendar = async () => {
    if (!selectedPlan || selectedPlan.activities.length === 0) return;
    setIsExportingToCalendar(true);
    const result = await exportPlanToCalendar(selectedPlan);
    setIsExportingToCalendar(false);
    if (result.success) {
      const { added, skipped } = result;
      let message: string;
      if (added === 0 && skipped > 0) {
        message = 'Tous les événements étaient déjà dans le calendrier.';
      } else if (skipped > 0) {
        message = `${added} événement${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''}${skipped > 0 ? `, ${skipped} déjà présent${skipped > 1 ? 's' : ''}` : ''}.`;
      } else {
        message = `${added} événement${added > 1 ? 's' : ''} ajouté${added > 1 ? 's' : ''} à votre calendrier.`;
      }
      Alert.alert('Calendrier', message);
    } else {
      Alert.alert('Erreur', result.error);
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
      {/* Titre : Plans = intention + export, pas calendrier classique (voir docs/PLANS_VISION.md) */}
      <View style={styles.screenHeader}>
        <Text style={styles.screenTitle}>Sorties</Text>
        <Text style={styles.screenSubtitle}>Idées de journée • Ajoutez au calendrier quand vous voulez</Text>
      </View>
      {/* Choix de date (pas un calendrier de gestion long terme) */}
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
          <View style={styles.timelineHeaderActions}>
            {selectedPlan && selectedPlan.activities.length > 0 && (
              <TouchableOpacity
                style={styles.calendarExportButton}
                onPress={handleAddToCalendar}
                disabled={isExportingToCalendar}
                activeOpacity={0.7}
              >
                {isExportingToCalendar ? (
                  <ActivityIndicator size="small" color={darkColor} />
                ) : (
                  <>
                    <Ionicons name="calendar-outline" size={18} color={darkColor} />
                    <Text style={styles.calendarExportLabel}>Ajouter au calendrier</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
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
              <TouchableOpacity style={styles.editButton} onPress={handleAddEvent} activeOpacity={0.7}>
                <Ionicons name="add" size={20} color={darkColor} />
              </TouchableOpacity>
            )}
          </View>
        </View>
          
          {selectedPlan && selectedPlan.activities.length > 0 ? (
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
                contentContainerStyle={[styles.timelineScrollContent, { position: 'relative' }]}
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
                {/* Événements positionnés de manière absolue */}
                {(() => {
                  const eventPositions = calculateEventPositions();
                  const LEFT_OFFSET = 72; // 60px (timeColumn) + 12px (paddingLeft)
                  const dotGroups = new Map<string, typeof eventPositions[0][]>();
                  
                  // Regrouper les événements qui font partie d'un groupe de points
                  eventPositions.forEach((eventPos) => {
                    if (eventPos.isDot && eventPos.dotGroup) {
                      const groupKey = eventPos.dotGroup.map(a => a.id).sort().join('-');
                      if (!dotGroups.has(groupKey)) {
                        dotGroups.set(groupKey, []);
                      }
                      dotGroups.get(groupKey)!.push(eventPos);
                    }
                  });
                  
                  const renderedGroups = new Set<string>();
                  
                  return eventPositions.map((eventPos) => {
                    // Si c'est un rectangle arrondi (groupe de 3+ événements)
                    if (eventPos.isDot && eventPos.dotGroup) {
                      const groupKey = eventPos.dotGroup.map(a => a.id).sort().join('-');
                      
                      // Ne rendre qu'une fois par groupe (avec tous les rectangles)
                      if (!renderedGroups.has(groupKey)) {
                        renderedGroups.add(groupKey);
                        const groupEvents = dotGroups.get(groupKey) || [];
                        
                        // Calculer la largeur de chaque rectangle pour prendre toute la largeur disponible
                        const SCREEN_WIDTH = Dimensions.get('window').width;
                        const PADDING_HORIZONTAL = 16;
                        const AVAILABLE_WIDTH = SCREEN_WIDTH - LEFT_OFFSET - 16 - PADDING_HORIZONTAL;
                        const gap = 2; // Espace entre les rectangles
                        const rectangleWidth = (AVAILABLE_WIDTH - (gap * (groupEvents.length - 1))) / groupEvents.length;
                        
                        return groupEvents.map((dotEvent, index) => {
                          // Calculer la position top et la hauteur pour chaque événement
                          const eventStartHour = parseInt(dotEvent.activity.startTime?.split(':')[0] || '0');
                          const eventStartMin = parseInt(dotEvent.activity.startTime?.split(':')[1] || '0');
                          
                          // Calculer la durée réelle en heures
                          let durationInHours = 1;
                          if (dotEvent.activity.endTime) {
                            const [startHourNum, startMinNum] = (dotEvent.activity.startTime || '0:0').split(':').map(Number);
                            const [endHourNum, endMinNum] = dotEvent.activity.endTime.split(':').map(Number);
                            const startMinutes = startHourNum * 60 + startMinNum;
                            const endMinutes = endHourNum * 60 + endMinNum;
                            const durationMinutes = endMinutes - startMinutes;
                            durationInHours = durationMinutes / 60;
                          }
                          
                          const eventTop = (eventStartHour * 68) + (eventStartMin / 60) * 68;
                          const calculatedHeight = durationInHours * 68 - 8;
                          const eventHeight = Math.max(20, calculatedHeight); // Minimum 20px
                          
                          return (
                            <TouchableOpacity
                              key={`dot-${dotEvent.activity.id}`}
                              style={[
                                styles.dotRectangleContainer,
                                {
                                  top: eventTop,
                                  left: LEFT_OFFSET + (index * (rectangleWidth + gap)),
                                  width: rectangleWidth,
                                  height: eventHeight,
                                  zIndex: eventPos.zIndex,
                                },
                              ]}
                              onPress={() => {
                                // Ouvrir le formulaire pour éditer le plan
                                if (selectedPlan) {
                                  setEditingPlan(selectedPlan);
                                  setIsFormVisible(true);
                                }
                              }}
                              activeOpacity={0.7}
                            >
                              <Text 
                                style={styles.dotRectangleText}
                                numberOfLines={Math.floor(eventHeight / 12)} // Ajuster le nombre de lignes selon la hauteur
                                ellipsizeMode="tail"
                              >
                                {dotEvent.activity.place?.placeName || dotEvent.activity.place?.rawTitle || 'Lieu sans nom'}
                              </Text>
                            </TouchableOpacity>
                          );
                        });
                      }
                      return null;
                    }
                  
                    // Sinon, afficher l'événement complet
                    return (
                      <View
                        key={`absolute-${eventPos.activity.id}`}
                        style={[
                          styles.absoluteEvent,
                          {
                            top: eventPos.top,
                            height: eventPos.height,
                            left: eventPos.left,
                            width: eventPos.width,
                            zIndex: eventPos.zIndex,
                          },
                        ]}
                      >
                        <EventCard
                          activity={eventPos.activity}
                          onPress={() => handleEventPress(eventPos.activity)}
                          height={eventPos.height}
                        />
                      </View>
                    );
                  });
                })()}
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
  screenHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: darkColor,
  },
  screenSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
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
  timelineHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calendarExportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  calendarExportLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: darkColor,
  },
  editButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineScroll: {
    width: '100%',
  },
  absoluteEvent: {
    position: 'absolute',
    zIndex: 10,
  },
  timelineScrollContent: {
    paddingBottom: 100,
    overflow: 'visible',
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
  eventDotContainer: {
    position: 'absolute',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dotRectangleContainer: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: '#F8F8F8',
    borderLeftWidth: 3,
    borderLeftColor: darkColor,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  dotRectangleText: {
    fontSize: 10,
    fontWeight: '500',
    color: darkColor,
    textAlign: 'center',
  },
});
