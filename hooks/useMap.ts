import { useState, useEffect, useRef, useCallback } from 'react';
import { Region } from 'react-native-maps';
import MapView from 'react-native-maps';
import * as Location from 'expo-location';
import { calculateDistance } from '@/utils/distance';
import type { Place, PlaceSummary } from '@/types/api';

const DISTANCE_THRESHOLD = 100; // Seuil de distance pour déclencher l'effet de dézoom/rezoom (100 km)
const ANIMATION_DURATION = 1000; // Durée fixe de l'animation en ms

/**
 * Hook pour gérer la carte (localisation, région, animations)
 */
export function useMap() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<Region | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mapViewRef = useRef<MapView>(null);

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
          // Fallback : animation normale sans vérification de distance
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
          // Fallback : animation normale
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
            // Fallback : animation normale
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

          // Étape 1 : Dézoomer pour voir une zone plus large
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
          // Petite distance : animation normale
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
        // Fallback si getCamera échoue : animation normale
        if (mapViewRef.current) {
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

  // Charger la localisation au montage
  useEffect(() => {
    loadLocation();
  }, [loadLocation]);

  return {
    location,
    region,
    loadingLocation,
    errorMsg,
    mapViewRef,
    animateToPlace,
    loadLocation,
  };
}

