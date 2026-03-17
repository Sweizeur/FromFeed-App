/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const darkColor = '#04060A';

export const darkColorWithAlpha = (alpha: number): string => {
  return `rgba(4, 6, 10, ${alpha})`;
};

export const Colors = {
  light: {
    text: '#0B1220',
    background: '#F3F1EC',
    surface: '#FAF8F2',
    border: '#E2DED6',
    tint: tintColorLight,
    icon: '#6B7280',
    tabIconDefault: '#6B7280',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    surface: '#1C1D1E',
    border: '#2C2E30',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};
