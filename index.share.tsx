import React, { useEffect, useState } from 'react';
import {
  AppRegistry,
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
} from 'react-native';
import { close, Text } from 'expo-share-extension';
import * as SecureStore from 'expo-secure-store';
import { Colors, darkColor, darkColorWithAlpha } from '@/constants/theme';

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  'https://fromfeed-backend-production.up.railway.app';
const TOKEN_KEY = 'fromfeed_auth_token';
const PENDING_TASK_KEY = 'fromfeed_pending_task';
const KEYCHAIN_GROUP = 'group.fr.sweizeur.fromfeed';

const SUPPORTED_HOSTS = [
  'tiktok.com',
  'vm.tiktok.com',
  'instagram.com',
  'www.instagram.com',
  'www.tiktok.com',
];

/** Couleurs sémantiques pour la share extension (non exposées dans theme) */
const SUCCESS_GREEN = '#34C759';
const ERROR_RED = '#FF3B30';
const BUTTON_BG = '#1A1A1A';

const light = Colors.light;

/**
 * Extrait le hostname d'une URL sans utiliser new URL(), car le @ dans les paths
 * TikTok/Instagram (ex. /@username/video/...) est interprété comme userinfo@host par URL.
 */
function getHostnameFromUrl(url: string): string | null {
  const cleaned = url.trim();
  if (!cleaned) return null;
  const match = cleaned.match(/^https?:\/\/([^/?#]+)/);
  return match ? match[1].toLowerCase() : null;
}

function isSupportedLink(url: string): boolean {
  const cleaned = url.trim();
  if (!cleaned) return false;
  const host = getHostnameFromUrl(cleaned);
  if (!host) return false;
  return SUPPORTED_HOSTS.some((h) => host === h || host.endsWith('.' + h));
}

async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY, {
      accessGroup: KEYCHAIN_GROUP,
    });
  } catch {
    return null;
  }
}

async function sendLink(url: string): Promise<{ taskId?: string }> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BACKEND_URL}/api/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Props reçues par la share extension (expo-share-extension peut les mettre dans initialProps) */
type ShareExtensionProps = {
  url?: string;
  text?: string;
  initialProps?: { url?: string; text?: string };
  rootTag?: number;
  fabric?: boolean;
  initialViewWidth?: number;
  initialViewHeight?: number;
  pixelRatio?: number;
  fontScale?: number;
};

function getUrlFromProps(props: ShareExtensionProps): string | undefined {
  return props.url ?? props.initialProps?.url;
}

function getTextFromProps(props: ShareExtensionProps): string | undefined {
  return props.text ?? props.initialProps?.text;
}

function extractUrl(props: ShareExtensionProps): string | null {
  const url = getUrlFromProps(props);
  if (url) return url.trim();

  const text = getTextFromProps(props);
  if (!text) return null;
  const raw =
    text.match(/https?:\/\/[^\s]+/)?.[0] ??
    (text.startsWith('http://') || text.startsWith('https://') ? text : null);
  if (!raw) return null;
  return raw.trim();
}

type Phase = 'loading' | 'success' | 'error' | 'unsupported';

function ShareExtensionRoot(props: ShareExtensionProps) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    const url = extractUrl(props);

    (async () => {

      if (!url) {
        setPhase('error');
        setMessage("Le lien partagé n'a pas pu être lu.");
        return;
      }

      if (!isSupportedLink(url)) {
        setPhase('unsupported');
        setMessage(
          "FromFeed n'accepte que les liens TikTok et Instagram pour le moment."
        );
        return;
      }

      try {
        const data = await sendLink(url);
        if (cancelled) return;
        if (data?.taskId) {
          try {
            await SecureStore.setItemAsync(PENDING_TASK_KEY, data.taskId, {
              accessGroup: KEYCHAIN_GROUP,
            });
          } catch {
            // ignore
          }
          setPhase('success');
          setMessage(
            "Ton lien a bien été envoyé.\nIl sera dans ta liste quand tu ouvriras l'app."
          );
        } else {
          setPhase('error');
          setMessage("Connecte-toi dans l'app FromFeed puis réessaie.");
        }
      } catch {
        if (!cancelled) {
          setPhase('error');
          setMessage("Connecte-toi dans l'app FromFeed puis réessaie.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [props.url, props.text, props.initialProps?.url, props.initialProps?.text]);

  const isLoading = phase === 'loading';
  const isSuccess = phase === 'success';
  const accentColor =
    isSuccess ? SUCCESS_GREEN
    : phase === 'unsupported' ? light.icon
    : ERROR_RED;

  return (
    <View style={[styles.backdrop, { backgroundColor: darkColorWithAlpha(0.5) }]}>
      <View style={[styles.card, { backgroundColor: light.surface }]}>
        <Text style={[styles.brand, { color: light.icon }]} allowFontScaling={false}>
          FromFeed
        </Text>

        {isLoading ? (
          <View style={styles.iconWrap}>
            <ActivityIndicator size="large" color={light.tint} />
          </View>
        ) : (
          <View style={[styles.iconCircle, { backgroundColor: accentColor }]}>
            <Text style={styles.iconGlyph} allowFontScaling={false}>
              {isSuccess ? '✓' : '✕'}
            </Text>
          </View>
        )}

        <Text style={[styles.title, { color: light.text }]} allowFontScaling={false}>
          {isLoading
            ? 'Analyse en cours…'
            : isSuccess
              ? 'Lien reçu !'
              : phase === 'unsupported'
                ? 'Lien non supporté'
                : 'Une erreur est survenue'}
        </Text>

        {!isLoading && (
          <Text style={[styles.body, { color: light.icon }]} allowFontScaling={false}>
            {message}
          </Text>
        )}

        {!isLoading && (
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => close()}
          >
            <Text style={styles.buttonLabel} allowFontScaling={false}>
              {isSuccess ? 'Parfait' : 'OK'}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },

  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: darkColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: { elevation: 12 },
    }),
  },

  brand: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 20,
  },

  iconWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconGlyph: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: Platform.OS === 'ios' ? 2 : 0,
  },

  title: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },

  body: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 22,
  },

  button: {
    marginTop: 24,
    width: '100%',
    height: 48,
    backgroundColor: BUTTON_BG,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  buttonPressed: {
    opacity: 0.8,
  },

  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
});

AppRegistry.registerComponent('shareExtension', () => ShareExtensionRoot);
