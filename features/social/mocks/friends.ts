import type { Friend } from '@/features/social/types';

export const MOCK_FRIENDS: Friend[] = [
  { id: '1', name: 'Marie Dupont', username: '@marie.dpt', avatar: 'MD', avatarColor: '#5856D6', placesCount: 42, mutualFriends: 3 },
  { id: '2', name: 'Lucas Martin', username: '@lucas_m', avatar: 'LM', avatarColor: '#FF9500', placesCount: 18, mutualFriends: 7 },
  { id: '3', name: 'Chloé Bernard', username: '@chloe.b', avatar: 'CB', avatarColor: '#FF2D55', placesCount: 65, mutualFriends: 2 },
  { id: '4', name: 'Thomas Petit', username: '@tom_petit', avatar: 'TP', avatarColor: '#34C759', placesCount: 31, mutualFriends: 5 },
  { id: '5', name: 'Emma Leroy', username: '@emma.leroy', avatar: 'EL', avatarColor: '#007AFF', placesCount: 27, mutualFriends: 1 },
  { id: '6', name: 'Hugo Moreau', username: '@hugo.m', avatar: 'HM', avatarColor: '#AF52DE', placesCount: 53, mutualFriends: 4 },
  { id: '7', name: 'Léa Roux', username: '@lea_rx', avatar: 'LR', avatarColor: '#FF3B30', placesCount: 12, mutualFriends: 6 },
  { id: '8', name: 'Nathan Garcia', username: '@nath.g', avatar: 'NG', avatarColor: '#30B0C7', placesCount: 89, mutualFriends: 2 },
];

export const MOCK_COLLECTION_FRIENDS = MOCK_FRIENDS.slice(0, 5).map(
  ({ placesCount: _placesCount, mutualFriends: _mutualFriends, ...friend }) => friend
);
