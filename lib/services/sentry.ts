/**
 * Sentry error reporting setup.
 *
 * Pour activer après le lancement :
 *   1. Ajoute EXPO_PUBLIC_SENTRY_DSN dans .env
 *   2. Rebuild l'app
 *
 * Sans DSN : init/capture sont des no-ops, l'app fonctionne normalement.
 */

import * as Sentry from '@sentry/react-native';

let sentryEnabled = false;

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    enabled: !__DEV__,
    tracesSampleRate: 0.2,
    environment: __DEV__ ? 'development' : 'production',
  });
  sentryEnabled = true;
}

export function captureException(error: unknown) {
  if (sentryEnabled) Sentry.captureException(error);
}

export function captureMessage(message: string) {
  if (sentryEnabled) Sentry.captureMessage(message);
}
