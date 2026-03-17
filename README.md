# FromFeed App

Application mobile Expo / React Native pour enregistrer des lieux, les organiser en collections et utiliser une experience IA autour des plans et conversations.

## Stack

- Expo Router
- React Native
- TypeScript
- PNPM

## Scripts

```bash
pnpm install
pnpm start
pnpm ios
pnpm android
pnpm lint
```

## Structure

- `app/`: routes Expo Router
- `features/`: logique et composants par domaine produit
- `components/ui/`: primitives de presentation partagees
- `components/common/`: composants transverses
- `lib/api/`: acces backend
- `types/`: types backend et types partages

## Principes d'architecture

- Les fichiers dans `app/` doivent rester des points d'entree minces.
- La logique metier doit vivre dans `features/`.
- `components/ui/` et `components/common/` ne doivent contenir que du vrai partage transversal.
- Les placeholders produit peuvent rester tant qu'ils sont isoles dans la bonne feature.
