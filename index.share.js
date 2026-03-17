import React, { useEffect, useState } from "react";
import {
  AppRegistry,
  View,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
} from "react-native";
import { close, Text } from "expo-share-extension";
import * as SecureStore from "expo-secure-store";

const BRAND_TEAL = "#0a7ea4";
const SURFACE = "#FAF8F2";
const TEXT_PRIMARY = "#0B1220";
const TEXT_MUTED = "#6B7280";
const BUTTON_BG = "#1A1A1A";
const SUCCESS_GREEN = "#34C759";
const ERROR_RED = "#FF3B30";
const OVERLAY = "rgba(4,6,10,0.5)";

const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  "https://fromfeed-backend-production.up.railway.app";
const TOKEN_KEY = "fromfeed_auth_token";
const PENDING_TASK_KEY = "fromfeed_pending_task";
const KEYCHAIN_GROUP = "group.com.sweizeur.fromfeedapp";

const SUPPORTED_HOSTS = [
  "tiktok.com",
  "vm.tiktok.com",
  "instagram.com",
  "www.instagram.com",
  "www.tiktok.com",
];

function isSupportedLink(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return SUPPORTED_HOSTS.some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

async function getToken() {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY, {
      accessGroup: KEYCHAIN_GROUP,
    });
  } catch {
    return null;
  }
}

async function sendLink(url) {
  const token = await getToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BACKEND_URL}/api/tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function extractUrl(props) {
  if (props.url) return props.url;
  if (props.text) {
    const m = props.text.match(/https?:\/\/[^\s]+/);
    if (m) return m[0];
    if (props.text.startsWith("http://") || props.text.startsWith("https://"))
      return props.text;
  }
  return null;
}

function ShareExtensionRoot(props) {
  const [phase, setPhase] = useState("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const url = extractUrl(props);

      if (!url) {
        setPhase("error");
        setMessage("Le lien partagé n'a pas pu être lu.");
        return;
      }

      if (!isSupportedLink(url)) {
        setPhase("unsupported");
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
          } catch {}
          setPhase("success");
          setMessage(
            "Ton lien a bien été envoyé.\nIl sera dans ta liste quand tu ouvriras l'app."
          );
        } else {
          setPhase("error");
          setMessage("Connecte-toi dans l'app FromFeed puis réessaie.");
        }
      } catch {
        if (!cancelled) {
          setPhase("error");
          setMessage("Connecte-toi dans l'app FromFeed puis réessaie.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const isLoading = phase === "loading";
  const isSuccess = phase === "success";
  const accentColor = isSuccess
    ? SUCCESS_GREEN
    : phase === "unsupported"
      ? TEXT_MUTED
      : ERROR_RED;

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        {/* Branding */}
        <Text style={styles.brand} allowFontScaling={false}>
          FromFeed
        </Text>

        {/* Icon */}
        {isLoading ? (
          <View style={styles.iconWrap}>
            <ActivityIndicator size="large" color={BRAND_TEAL} />
          </View>
        ) : (
          <View style={[styles.iconCircle, { backgroundColor: accentColor }]}>
            <Text style={styles.iconGlyph} allowFontScaling={false}>
              {isSuccess ? "✓" : "✕"}
            </Text>
          </View>
        )}

        {/* Title */}
        <Text style={styles.title} allowFontScaling={false}>
          {isLoading
            ? "Analyse en cours…"
            : isSuccess
              ? "Lien reçu !"
              : phase === "unsupported"
                ? "Lien non supporté"
                : "Une erreur est survenue"}
        </Text>

        {/* Body */}
        {!isLoading && (
          <Text style={styles.body} allowFontScaling={false}>
            {message}
          </Text>
        )}

        {/* Button */}
        {!isLoading && (
          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => close()}
          >
            <Text style={styles.buttonLabel} allowFontScaling={false}>
              {isSuccess ? "Parfait" : "OK"}
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
    backgroundColor: OVERLAY,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },

  card: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: SURFACE,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#04060A",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
      },
      android: { elevation: 12 },
    }),
  },

  brand: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_MUTED,
    letterSpacing: 0.4,
    marginBottom: 20,
  },

  iconWrap: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },

  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  iconGlyph: {
    fontSize: 26,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: Platform.OS === "ios" ? 2 : 0,
  },

  title: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: "700",
    color: TEXT_PRIMARY,
    textAlign: "center",
  },

  body: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "400",
    color: TEXT_MUTED,
    textAlign: "center",
    lineHeight: 22,
  },

  button: {
    marginTop: 24,
    width: "100%",
    height: 48,
    backgroundColor: BUTTON_BG,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },

  buttonPressed: {
    opacity: 0.8,
  },

  buttonLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
});

AppRegistry.registerComponent("shareExtension", () => ShareExtensionRoot);
