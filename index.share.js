import React, { useEffect, useState } from "react";
import { AppRegistry, View, StyleSheet, ActivityIndicator } from "react-native";
import { close, Text } from "expo-share-extension";
import { createLinkPreviewTask } from "./lib/api";

function extractUrlFromProps(props) {
  if (props.url) return props.url;
  if (props.text) {
    const match = props.text.match(/https?:\/\/[^\s]+/);
    if (match) return match[0];
    if (props.text.startsWith("http://") || props.text.startsWith("https://")) return props.text;
  }
  return null;
}

function ShareProcessingView(props) {
  const [statusText, setStatusText] = useState(
    "Ton lien est en cours d’analyse par FromFeed.\nTu peux fermer cette fenêtre."
  );

  useEffect(() => {
    let cancelled = false;

    (async function run() {
      const url = extractUrlFromProps(props);
      if (!url || cancelled) {
        setStatusText("Le lien partagé n’a pas pu être lu.\nTu peux réessayer depuis l’app.");
        return;
      }

      setStatusText("Analyse du lien en cours…");

      try {
        const response = await createLinkPreviewTask(url);
        if (cancelled) return;
        if (response?.taskId) {
          setStatusText("C’est fait ! Le lieu sera dans ta liste quand tu ouvriras FromFeed.");
        } else {
          setStatusText("Ouvre l’app FromFeed pour t’identifier et réessayer.");
        }
      } catch (_) {
        if (!cancelled) {
          setStatusText("Ouvre l’app FromFeed pour t’identifier et réessayer.");
        }
      }

      // Fermer après un court délai pour laisser lire le message
      setTimeout(() => {
        if (!cancelled) close();
      }, 3000);
    })();

    return () => {
      cancelled = true;
    };
  }, [props]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#0a7ea4" />
      <Text style={styles.title} allowFontScaling={false}>
        Lien en cours d’analyse…
      </Text>
      <Text style={styles.subtitle} allowFontScaling={false}>
        {statusText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#04060A",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    textAlign: "center",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#A0A4AF",
    textAlign: "center",
    lineHeight: 22,
  },
});

// IMPORTANT: pour expo-share-extension, le nom doit être exactement "shareExtension"
AppRegistry.registerComponent("shareExtension", () => ShareProcessingView);

