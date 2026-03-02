import { useState, useEffect, useRef, useCallback } from 'react';
import { Region } from 'react-native-maps';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import { calculateDistance } from '@/utils/distance';
import type { Place, PlaceSummary } from '@/types/api';

const DISTANCE_THRESHOLD = 100; // Seuil de distance pour déclencher l'effet de dézoom/rezoom (100 km)
const ANIMATION_DURATION = 1000; // Durée fixe de l'animation en ms
const PROGRAMMATIC_GRACE_MS = 1500; // Fenêtre pour ignorer onRegionChangeComplete après une animation

/**
 * Hook pour gérer la carte (localisation, région, animations)
 */
export function useMap() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mapViewRef = useRef<MapView>(null);
  const lastProgrammaticAt = useRef<number>(0);
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

  /**
   * Charge la localisation de l'utilisateur
   */
  const loadLocation = useCallback(async () => {
    try {
      setLoadingLocation(true);
      setErrorMsg(null);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Location permission denied');
        setLoadingLocation(false);
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      const initialRegion: Region = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      setRegion(initialRegion);
    } catch (error) {
      __DEV__ && console.error('[useMap] Error getting location:', error);
      setErrorMsg('Unable to get your location.');
    } finally {
      setLoadingLocation(false);
    }
  }, []);

  /**
   * Anime la carte vers une place avec gestion de la distance
   */
  const animateToPlace = useCallback(
    async (place: Place | PlaceSummary) => {
      // Vérifier que la place est valide et a des coordonnées valides
      if (!place || !place.id) {
        __DEV__ && console.warn('[useMap] Place invalide:', place);
        return;
      }

      if (
        place.lat == null ||
        place.lon == null ||
        isNaN(place.lat) ||
        isNaN(place.lon) ||
        !isFinite(place.lat) ||
        !isFinite(place.lon)
      ) {
        return;
      }

      const placeLat = place.lat;
      const placeLon = place.lon;

      if (!mapViewRef.current) return;

      try {
        // Obtenir la région actuelle de la carte
        const camera = await mapViewRef.current.getCamera();
        if (!camera || !camera.center || !mapViewRef.current) {
          lastProgrammaticAt.current = Date.now();
          mapViewRef.current?.animateToRegion(
            {
              latitude: placeLat,
              longitude: placeLon,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            ANIMATION_DURATION
          );
          return;
        }

        const currentLat = camera.center.latitude;
        const currentLon = camera.center.longitude;

        // Vérifier que les coordonnées actuelles sont valides
        if (
          isNaN(currentLat) ||
          isNaN(currentLon) ||
          !isFinite(currentLat) ||
          !isFinite(currentLon)
        ) {
          lastProgrammaticAt.current = Date.now();
          mapViewRef.current.animateToRegion(
            {
              latitude: placeLat,
              longitude: placeLon,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            ANIMATION_DURATION
          );
          return;
        }

        // Calculer la distance entre la position actuelle et le lieu
        const distance = calculateDistance(currentLat, currentLon, placeLat, placeLon);

        if (distance > DISTANCE_THRESHOLD) {
          // Grande distance : faire un dézoom puis rezoom
          const zoomOutDelta = Math.min(180, Math.max(10, distance * 0.15));
          const midLat = (currentLat + placeLat) / 2;
          const midLon = (currentLon + placeLon) / 2;

          // Vérifier que le point médian est valide
          if (
            isNaN(midLat) ||
            isNaN(midLon) ||
            !isFinite(midLat) ||
            !isFinite(midLon) ||
            !mapViewRef.current
          ) {
            lastProgrammaticAt.current = Date.now();
            mapViewRef.current.animateToRegion(
              {
                latitude: placeLat,
                longitude: placeLon,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              },
              ANIMATION_DURATION
            );
            return;
          }

          lastProgrammaticAt.current = Date.now();
          mapViewRef.current.animateToRegion(
            {
              latitude: midLat,
              longitude: midLon,
              latitudeDelta: zoomOutDelta,
              longitudeDelta: zoomOutDelta,
            },
            ANIMATION_DURATION
          );

          // Étape 2 : Après le dézoom, animer vers le lieu avec zoom normal
          setTimeout(() => {
            if (mapViewRef.current) {
              lastProgrammaticAt.current = Date.now();
              mapViewRef.current.animateToRegion(
                {
                  latitude: placeLat,
                  longitude: placeLon,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                },
                ANIMATION_DURATION
              );
            }
          }, ANIMATION_DURATION + 100); // Délai pour laisser le temps au dézoom de se terminer
        } else {
          lastProgrammaticAt.current = Date.now();
          mapViewRef.current.animateToRegion(
            {
              latitude: placeLat,
              longitude: placeLon,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            ANIMATION_DURATION
          );
        }
      } catch (error) {
        __DEV__ && console.error('[useMap] Erreur lors de la récupération de la caméra:', error);
        if (mapViewRef.current) {
          lastProgrammaticAt.current = Date.now();
          mapViewRef.current.animateToRegion(
            {
              latitude: placeLat,
              longitude: placeLon,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            },
            ANIMATION_DURATION
          );
        }
      }
    },
    []
  );

  /** À appeler avant toute animation programmatique pour ignorer le prochain onRegionChangeComplete */
  const markProgrammaticAnimation = useCallback(() => {
    lastProgrammaticAt.current = Date.now();
  }, []);

  /** true si le dernier changement de région était une animation (pas un geste utilisateur) */
  const isProgrammaticChange = useCallback(() => {
    return Date.now() - lastProgrammaticAt.current < PROGRAMMATIC_GRACE_MS;
  }, []);

  /**
   * Centre la carte sur la position de l'utilisateur
   */
  const animateToUser = useCallback(async () => {
    if (!location || !mapViewRef.current) return;
    markProgrammaticAnimation();
    mapViewRef.current.animateToRegion(
      {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      ANIMATION_DURATION
    );
  }, [location, markProgrammaticAnimation]);

  /**
   * Active le suivi en continu : la carte se recentre à chaque déplacement de l'utilisateur.
   * Options proches Waze / Google Maps : précision navigation + mises à jour très rapprochées.
   * (activityType est réservé aux tâches background dans expo-location, pas à watchPositionAsync.)
   */
  const startWatchingUser = useCallback(async () => {
    if (watchSubscriptionRef.current) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 1,
          timeInterval: 500,
        },
        (newLocation) => {
          setLocation(newLocation);
          if (!mapViewRef.current) return;
          markProgrammaticAnimation();
          mapViewRef.current.animateToRegion(
            {
              latitude: newLocation.coords.latitude,
              longitude: newLocation.coords.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            },
            ANIMATION_DURATION
          );
        }
      );
      watchSubscriptionRef.current = sub;
    } catch (e) {
      __DEV__ && console.error('[useMap] watchPositionAsync error:', e);
    }
  }, [markProgrammaticAnimation]);

  /**
   * Arrête le suivi en continu de la position.
   */
  const stopWatchingUser = useCallback(() => {
    if (watchSubscriptionRef.current) {
      watchSubscriptionRef.current.remove();
      watchSubscriptionRef.current = null;
    }
  }, []);

  // Charger la localisation au montage
  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  useEffect(() => {
    return () => {
      if (watchSubscriptionRef.current) {
        watchSubscriptionRef.current.remove();
        watchSubscriptionRef.current = null;
      }
    };
  }, []);

  return {
    location,
    region,
    loadingLocation,
    errorMsg,
    mapViewRef,
    animateToPlace,
    animateToUser,
    loadLocation,
    startWatchingUser,
    stopWatchingUser,
    isProgrammaticChange,
  };
}

