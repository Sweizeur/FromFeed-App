import { useState, useEffect, useRef, useCallback } from 'react';
import type { Camera } from '@rnmapbox/maps';
import type React from 'react';
import * as Location from 'expo-location';
import type { Place, PlaceSummary } from '@/features/places/types';
const ANIMATION_DURATION_MS = 650;
const PROGRAMMATIC_GRACE_MS = 1500;
const DEFAULT_ZOOM = 14;

export interface MapboxRegion {
  centerCoordinate: [number, number];
  zoomLevel: number;
}

/**
 * Hook pour gérer la carte Mapbox (localisation, caméra, animations).
 * Nécessite que le composant parent rende <Camera ref={cameraRef} ... /> avec la ref renvoyée.
 */
export function useMap() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [region, setRegion] = useState<MapboxRegion | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const cameraRef = useRef<React.ComponentRef<typeof Camera> | null>(null);
  const lastProgrammaticAt = useRef<number>(0);
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);

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
      const { longitude, latitude } = currentLocation.coords;
      setRegion({
        centerCoordinate: [longitude, latitude],
        zoomLevel: DEFAULT_ZOOM,
      });
    } catch (error) {
      __DEV__ && console.error('[useMap] Error getting location:', error);
      setErrorMsg('Unable to get your location.');
    } finally {
      setLoadingLocation(false);
    }
  }, []);

  const animateToPlace = useCallback(
    async (place: Place | PlaceSummary) => {
      if (!place?.id || place.lat == null || place.lon == null) return;
      if (
        isNaN(place.lat) ||
        isNaN(place.lon) ||
        !isFinite(place.lat) ||
        !isFinite(place.lon)
      )
        return;
      const cam = cameraRef.current;
      if (!cam) return;
      lastProgrammaticAt.current = Date.now();
      cam.flyTo([place.lon, place.lat], ANIMATION_DURATION_MS);
    },
    []
  );

  const markProgrammaticAnimation = useCallback(() => {
    lastProgrammaticAt.current = Date.now();
  }, []);

  const isProgrammaticChange = useCallback(() => {
    return Date.now() - lastProgrammaticAt.current < PROGRAMMATIC_GRACE_MS;
  }, []);

  const animateToUser = useCallback(async () => {
    if (!location || !cameraRef.current) return;
    markProgrammaticAnimation();
    const { longitude, latitude } = location.coords;
    cameraRef.current.flyTo([longitude, latitude], ANIMATION_DURATION_MS);
  }, [location, markProgrammaticAnimation]);

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
        }
      );
      watchSubscriptionRef.current = sub;
    } catch (e) {
      __DEV__ && console.error('[useMap] watchPositionAsync error:', e);
    }
  }, [markProgrammaticAnimation]);

  const stopWatchingUser = useCallback(() => {
    if (watchSubscriptionRef.current) {
      watchSubscriptionRef.current.remove();
      watchSubscriptionRef.current = null;
    }
  }, []);

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
    cameraRef,
    animateToPlace,
    animateToUser,
    loadLocation,
    startWatchingUser,
    stopWatchingUser,
    isProgrammaticChange,
  };
}
