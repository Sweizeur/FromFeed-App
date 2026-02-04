import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, Easing } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { darkColor } from '@/constants/theme';

const useGlass = isLiquidGlassAvailable();
const AI_GRADIENT_COLORS = ['#C7366F', '#7C3AED', '#6D28D9'] as const;
const AI_GLASS_TINT = '#7C3AED'; // teinte violette pour Liquid Glass

interface AnimatedAIButtonProps {
  onPress: () => void;
  size?: number;
}

export default function AnimatedAIButton({ onPress, size = 38 }: AnimatedAIButtonProps) {
  const isPressed = useSharedValue(0);
  const borderRotation = useSharedValue(0);
  const sparkleScale1 = useSharedValue(1);
  const sparkleScale2 = useSharedValue(1);
  const sparkleScale3 = useSharedValue(1);

  useEffect(() => {
    // Animation de rotation de la bordure en continu
    borderRotation.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );

    // Animation des sparkles en continu
    const sparkleSequence1 = withSequence(
      withTiming(1.2, { duration: 150, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 150, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 200 }),
      withTiming(1.2, { duration: 150, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 150, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 200 }),
      withTiming(1.2, { duration: 150, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 150, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 500 }) // Pause avant de recommencer
    );

    const sparkleSequence2 = withSequence(
      withTiming(1, { duration: 320 }),
      withTiming(1.2, { duration: 150, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 150, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 200 }),
      withTiming(1.2, { duration: 150, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 150, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 500 }) // Pause avant de recommencer
    );

    const sparkleSequence3 = withSequence(
      withTiming(1, { duration: 660 }),
      withTiming(1.2, { duration: 150, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 150, easing: Easing.in(Easing.quad) }),
      withTiming(1, { duration: 500 }) // Pause avant de recommencer
    );

    sparkleScale1.value = withRepeat(sparkleSequence1, -1, false);
    sparkleScale2.value = withRepeat(sparkleSequence2, -1, false);
    sparkleScale3.value = withRepeat(sparkleSequence3, -1, false);
  }, []);

  const borderAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${borderRotation.value}deg` }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (isPressed.value * 0.1) }],
  }));

  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    // Animation de glow en continu (pulsation subtile)
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: isPressed.value > 0 
      ? isPressed.value * 0.75 
      : glowOpacity.value,
  }));

  const sparkle1AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkleScale1.value }],
  }));

  const sparkle2AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkleScale2.value }],
  }));

  const sparkle3AnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkleScale3.value }],
  }));

  const handlePressIn = () => {
    isPressed.value = withTiming(1, { duration: 200 });
  };

  const handlePressOut = () => {
    isPressed.value = withTiming(0, { duration: 200 });
  };

  const iconSize = size * 0.47;

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.container, { width: size, height: size }]}
    >
      <Animated.View style={[styles.borderContainer, borderAnimatedStyle]}>
        <Animated.View style={styles.dotsBorder} />
      </Animated.View>
      <Animated.View style={[styles.backgroundContainer, buttonAnimatedStyle]}>
        {useGlass ? (
          <GlassView style={styles.background} tintColor={AI_GLASS_TINT} />
        ) : (
          <LinearGradient
            colors={[...AI_GRADIENT_COLORS]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.background}
          />
        )}
      </Animated.View>
      <Animated.View style={[styles.glowContainer, glowAnimatedStyle]}>
        <LinearGradient
          colors={[...AI_GRADIENT_COLORS]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.glow}
        />
      </Animated.View>
      <View style={styles.sparkleContainer}>
        <Animated.View style={[styles.sparkleWrapper, sparkle1AnimatedStyle]}>
          <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
            <Path
              d="M14.187 8.096L15 5.25L15.813 8.096C16.0231 8.83114 16.4171 9.50062 16.9577 10.0413C17.4984 10.5819 18.1679 10.9759 18.903 11.186L21.75 12L18.904 12.813C18.1689 13.0231 17.4994 13.4171 16.9587 13.9577C16.4181 14.4984 16.0241 15.1679 15.814 15.903L15 18.75L14.187 15.904C13.9769 15.1689 13.5829 14.4994 13.0423 13.9587C12.5016 13.4181 11.8321 13.0241 11.097 12.814L8.25 12L11.096 11.187C11.8311 10.9769 12.5006 10.5829 13.0413 10.0423C13.5819 9.50162 13.9759 8.83214 14.186 8.097L14.187 8.096Z"
              fill="#fff"
              stroke="#fff"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.sparkleWrapper, sparkle2AnimatedStyle, StyleSheet.absoluteFill]}>
          <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
            <Path
              d="M6 14.25L5.741 15.285C5.59267 15.8785 5.28579 16.4206 4.85319 16.8532C4.42059 17.2858 3.87853 17.5927 3.285 17.741L2.25 18L3.285 18.259C3.87853 18.4073 4.42059 18.7142 4.85319 19.1468C5.28579 19.5794 5.59267 20.1215 5.741 20.715L6 21.75L6.259 20.715C6.40725 20.1216 6.71398 19.5796 7.14639 19.147C7.5788 18.7144 8.12065 18.4075 8.714 18.259L9.75 18L8.714 17.741C8.12065 17.5925 7.5788 17.2856 7.14639 16.853C6.71398 16.4204 6.40725 15.8784 6.259 15.285L6 14.25Z"
              fill="#fff"
              stroke="#fff"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.sparkleWrapper, sparkle3AnimatedStyle, StyleSheet.absoluteFill]}>
          <Svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none">
            <Path
              d="M6.5 4L6.303 4.5915C6.24777 4.75718 6.15472 4.90774 6.03123 5.03123C5.90774 5.15472 5.75718 5.24777 5.5915 5.303L5 5.5L5.5915 5.697C5.75718 5.75223 5.90774 5.84528 6.03123 5.96877C6.15472 6.09226 6.24777 6.24282 6.303 6.4085L6.5 7L6.697 6.4085C6.75223 6.24282 6.84528 6.09226 6.96877 5.96877C7.09226 5.84528 7.24282 5.75223 7.4085 5.697L8 5.5L7.4085 5.303C7.24282 5.24777 7.09226 5.15472 6.96877 5.03123C6.84528 4.90774 6.75223 4.75718 6.697 4.5915L6.5 4Z"
              fill="#fff"
              stroke="#fff"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  borderContainer: {
    position: 'absolute',
    width: '102%',
    height: '102%',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  dotsBorder: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    width: '100%',
    height: 8,
    backgroundColor: '#fff',
    opacity: 0.3,
    borderRadius: 4,
  },
  backgroundContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 9999,
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  background: {
    width: '100%',
    height: '100%',
    borderRadius: 9999,
  },
  glowContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 9999,
  },
  glow: {
    width: '100%',
    height: '100%',
    borderRadius: 9999,
    opacity: 0.75,
  },
  sparkleContainer: {
    position: 'relative',
    zIndex: 10,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  sparkleWrapper: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

