import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '@/contexts/AuthContext';
import { Colors, darkColor } from '@/constants/theme';

// Logo Google officiel (G multicolore)
function GoogleLogo() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}

// Logo Apple officiel
function AppleLogo() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="#fff">
      <Path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

export default function SignUpScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { isAuthenticated, loading: checkingAuth, signIn } = useAuth();
  const scheme = useColorScheme() ?? 'light';
  const isDark = scheme === 'dark';
  const theme = Colors[isDark ? 'dark' : 'light'];

  useEffect(() => {
    if (!checkingAuth && isAuthenticated) {
      router.replace('/(tabs)/map');
    }
  }, [checkingAuth, isAuthenticated, router]);

  const handlePhoneSignUp = () => {
    if (!phoneNumber || phoneNumber.length < 6) {
      Alert.alert('Numéro invalide', 'Merci de saisir un numéro de téléphone valide.');
      return;
    }

    const fullPhone = `${countryCode} ${phoneNumber}`;
    router.replace({
      pathname: '/(tabs)/map',
      params: { phone: fullPhone },
    });
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signIn();

      if (result.success) {
        router.replace('/(tabs)/map');
      } else if (result.errorCode === 'RATE_LIMIT') {
        Alert.alert(
          'Trop de tentatives',
          result.errorMessage || 'Veuillez patienter quelques instants avant de réessayer.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Erreur de connexion',
          result.errorMessage || 'Une erreur est survenue lors de la connexion avec Google.',
          [{ text: 'OK' }]
        );
      }
    } catch {
      Alert.alert('Erreur de connexion', 'Une erreur est survenue. Veuillez réessayer.', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = () => {
    // TODO: Implémenter l'authentification Apple (plus tard)
    Alert.alert('Bientôt disponible', "L'authentification Apple sera disponible prochainement.");
  };

  // Afficher un indicateur de chargement pendant la vérification de l'authentification
  if (checkingAuth) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.text} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Titre */}
          <Text style={[styles.title, { color: theme.text }]}>Let's create your FromFeed account.</Text>

          {/* Input téléphone */}
          <View style={styles.phoneContainer}>
            <Text style={[styles.phoneLabel, { color: theme.text }]}>Phone Number</Text>
            <View style={styles.phoneInputContainer}>
              <TouchableOpacity style={styles.countryCodeButton}>
                <Text style={styles.countryCodeText}>{countryCode}</Text>
                <Text style={styles.arrow}>▼</Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.phoneInput, { backgroundColor: theme.surface, color: theme.text }]}
                placeholder="Enter phone number"
                placeholderTextColor={theme.icon}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                editable={true}
              />
              <TouchableOpacity
                style={styles.nextButton}
                onPress={handlePhoneSignUp}
                disabled={!phoneNumber || phoneNumber.length < 10}
              >
                <Text style={styles.nextButtonText}>→</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Texte légal */}
          <Text style={[styles.legalText, { color: theme.icon }]}>
            By creating an account, you agree to our{' '}
            <Text style={styles.linkText}>Terms & Conditions</Text> and{' '}
            <Text style={styles.linkText}>Privacy Policy</Text>. You also agree to receive recurring text messages at the phone number provided - Msg & data rates may apply. Msg frequency varies. Reply STOP to cancel.
          </Text>

          {/* Séparateur */}
          <View style={styles.separator}>
            <View style={[styles.separatorLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.separatorText, { color: theme.icon }]}>OR</Text>
            <View style={[styles.separatorLine, { backgroundColor: theme.border }]} />
          </View>

          {/* Boutons sociaux */}
          <TouchableOpacity
            style={styles.socialButton}
            onPress={handleAppleSignIn}
            disabled={true}
          >
            <AppleLogo />
            <Text style={styles.socialButtonText}>Sign In with Apple</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.socialButton, styles.googleButton]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <GoogleLogo />
                <Text style={styles.socialButtonText}>Sign In with Google</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 24,
    paddingTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 40,
    fontFamily: Platform.select({
      ios: 'System',
      android: 'sans-serif-black',
    }),
  },
  phoneContainer: {
    marginBottom: 24,
  },
  phoneLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countryCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: darkColor,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  countryCodeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  arrow: {
    color: '#fff',
    fontSize: 12,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 16,
  },
  nextButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: darkColor,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
  },
  legalText: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 32,
  },
  linkText: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
    gap: 16,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  separatorText: {
    fontSize: 14,
    fontWeight: '500',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: darkColor,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  googleButton: {
    backgroundColor: darkColor,
  },
  socialButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

