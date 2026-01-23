import { useEffect, useRef, useState } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { apiRequest } from '@/lib/api';
import { getStoredToken } from '@/lib/auth-mobile';

// Configuration des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Hook pour gérer les notifications push
 */
export function useNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        setExpoPushToken(token);
        // Enregistrer le token sur le serveur
        registerTokenOnServer(token);
      }
    });

    // Écouter les notifications reçues quand l'app est au premier plan
    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });

    // Écouter les notifications sur lesquelles l'utilisateur a tapé
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('Notification tapée:', response);
      // Ici on pourrait naviguer vers une page spécifique
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return { expoPushToken, notification };
}

/**
 * Enregistre le token de notification push sur le serveur
 */
async function registerTokenOnServer(token: string) {
  try {
    const tokenAuth = await getStoredToken();
    if (!tokenAuth) {
      console.log('[Notifications] Pas de token d\'authentification, enregistrement du token push reporté');
      return;
    }

    const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
    
    await apiRequest('/api/notifications/register-token', {
      method: 'POST',
      body: JSON.stringify({
        token,
        platform,
      }),
    });

    console.log('[Notifications] Token enregistré sur le serveur');
  } catch (error) {
    console.error('[Notifications] Erreur lors de l\'enregistrement du token:', error);
  }
}

/**
 * Demande les permissions et enregistre le token de notification push
 */
async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('[Notifications] Permission refusée pour les notifications push');
      return null;
    }
    
    try {
      const projectId = '4ef7b9df-34c6-4f24-944c-30ca3f3a918c'; // EAS Project ID depuis app.json
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      console.log('[Notifications] Token Expo Push obtenu:', token);
    } catch (error: any) {
      // En mode développement avec un compte Apple Developer gratuit,
      // les notifications push ne sont pas supportées (nécessite un compte payant $99/an)
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('aps-environment') || errorMessage.includes('Push Notifications') || errorMessage.includes('Personal development teams')) {
        console.warn('[Notifications] Les notifications push nécessitent un compte Apple Developer payant ($99/an)');
        console.warn('[Notifications] En développement local, les notifications push ne sont pas disponibles');
        console.warn('[Notifications] Les notifications fonctionneront automatiquement en production avec EAS Build');
      } else {
        console.error('[Notifications] Erreur lors de l\'obtention du token:', error);
      }
      // Ne pas bloquer l'app si les notifications ne sont pas disponibles
      return null;
    }
  } else {
    console.log('[Notifications] Les notifications push ne fonctionnent que sur un appareil physique');
  }

  return token;
}
