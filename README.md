# FromFeed App

Application mobile **Expo / React Native** pour enregistrer des lieux (souvent découverts sur TikTok ou Instagram), les afficher sur une carte, les organiser en **collections**, construire des **plans** (journées) et discuter avec une **IA** qui s’appuie sur tes données.

Le tout consomme l’API du backend : voir [`../fromfeed-backend/README.md`](../fromfeed-backend/README.md).

## Stack

- Expo Router
- React Native
- TypeScript
- pnpm
- TanStack Query, Mapbox (`@rnmapbox/maps`), auth OAuth (Google) via le backend

## Prérequis

- Node.js 20+
- pnpm
- **Backend** FromFeed lancé (ou URL tunnel / staging) — voir `EXPO_PUBLIC_BACKEND_URL`
- Compte [Mapbox](https://account.mapbox.com/access-tokens/) pour la carte

## Configuration

```bash
cp .env.example .env
```

Variables courantes (détail dans `.env.example`) :

| Variable | Rôle |
|----------|------|
| `EXPO_PUBLIC_BACKEND_URL` | URL de l’API (défaut dev : `http://localhost:3001`) |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Token Mapbox pour la carte |
| `EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS` | Client ID Google OAuth (config iOS / utilisé pour toute l’app) |
| `EXPO_PUBLIC_USE_PROXY` | Proxy Expo pour OAuth en dev (`true` / `false`) |
| `EXPO_PUBLIC_SENTRY_DSN` | Monitoring d’erreurs (optionnel) |

Pour tester sur un appareil physique alors que l’API tourne en local, utilise un tunnel (ex. Cloudflare) et mets l’URL HTTPS dans `EXPO_PUBLIC_BACKEND_URL`.

## Scripts

```bash
pnpm install
pnpm start          # Expo dev server
pnpm ios            # build / run iOS (dev client)
pnpm android
pnpm lint
pnpm test
```

## Structure

- `app/` — routes Expo Router (entrées fines)
- `features/` — logique et écrans par domaine (lieux, IA, social, collections…)
- `components/ui/` — primitives UI partagées
- `components/common/` — composants transverses
- `lib/api/` — client HTTP vers le backend
- `types/` — types partagés / alignés backend

## Architecture

- Les fichiers dans `app/` restent des **points d’entrée minces**.
- La logique métier et l’UI riche vivent dans `features/`.
- `components/ui/` et `components/common/` : **partage réellement transversal** uniquement.
- Les placeholders produit peuvent rester s’ils sont isolés dans la bonne feature.

## Développement avec le monorepo

1. Démarrer PostgreSQL + Redis et le backend (`fromfeed-backend`, `pnpm run dev`).
2. Renseigner `EXPO_PUBLIC_BACKEND_URL` dans `fromfeed-app/.env`.
3. Lancer `pnpm start` dans `fromfeed-app` (ou `pnpm ios` / `pnpm android`).

Les routes d’auth mobile et le header `Authorization: Bearer` sont décrites dans le README du backend.
