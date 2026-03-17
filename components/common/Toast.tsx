import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { darkColor } from '@/constants/theme';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: ToastType;
  duration?: number;
  onHide?: () => void;
}

export default function Toast({
  visible,
  message,
  type = 'info',
  duration,
  onHide,
}: ToastProps) {
  // Durée par défaut : plus longue pour les erreurs
  const defaultDuration = type === 'error' ? 5000 : 3000;
  const toastDuration = duration ?? defaultDuration;
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideToast = () => {
    // Annuler le timer automatique
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Animer la sortie
    translateY.value = withTiming(-100, { duration: 250 });
    opacity.value = withTiming(0, { duration: 250 }, () => {
      if (onHide) {
        runOnJS(onHide)();
      }
    });
  };

  useEffect(() => {
    if (visible) {
      // Animer l'entrée avec une animation fluide (sans rebond)
      translateY.value = withTiming(0, { duration: 300 });
      opacity.value = withTiming(1, { duration: 300 });

      // Animer la sortie après la durée spécifiée
      timerRef.current = setTimeout(() => {
        hideToast();
      }, toastDuration);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    } else {
      // Réinitialiser immédiatement si visible devient false
      translateY.value = -100;
      opacity.value = 0;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [visible, toastDuration]);

  // Geste de swipe vers le haut pour fermer
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      'worklet';
      // Seulement si on swipe vers le haut (translationY négative)
      if (event.translationY < 0) {
        translateY.value = event.translationY;
        // Réduire l'opacité en fonction de la distance
        const progress = Math.min(Math.abs(event.translationY) / 100, 1);
        opacity.value = 1 - progress;
      }
    })
    .onEnd((event) => {
      'worklet';
      // Si on a swipé assez haut (plus de 50px) ou avec assez de vélocité
      if (event.translationY < -50 || event.velocityY < -500) {
        runOnJS(hideToast)();
      } else {
        // Sinon, revenir à la position initiale avec une animation fluide (sans rebond)
        translateY.value = withTiming(0, { duration: 200 });
        opacity.value = withTiming(1, { duration: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
      opacity: opacity.value,
    };
  });

  if (!visible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <Ionicons name="checkmark-circle" size={24} color="#fff" />;
      case 'error':
        return <Ionicons name="close-circle" size={24} color="#fff" />;
      default:
        return <Ionicons name="information-circle" size={24} color="#fff" />;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#34C759'; // Vert iOS
      case 'error':
        return '#FF3B30'; // Rouge iOS
      default:
        return '#007AFF'; // Bleu iOS
    }
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.container,
          {
            top: insets.top + 16,
            backgroundColor: getBackgroundColor(),
          },
          animatedStyle,
        ]}
      >
        <View style={styles.content}>
          {getIcon()}
          <Text style={styles.message}>{message}</Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: darkColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 10000,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  message: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

