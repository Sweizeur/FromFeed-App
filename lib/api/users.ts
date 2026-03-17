import { apiRequest } from './client';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  createdAt: string;
}

export interface UserSearchResult {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
}

export interface Friend {
  id: string;
  name: string;
  username: string | null;
  image: string | null;
}

export interface FriendRequest {
  id: string;
  from: Friend;
  createdAt: string;
}

export interface SentRequest {
  id: string;
  to: Friend;
  createdAt: string;
}

export async function getMyProfile(): Promise<UserProfile | null> {
  return apiRequest('/api/users/me');
}

export async function updateMyUsername(username: string): Promise<{ username: string } | null> {
  return apiRequest('/api/users/me/username', {
    method: 'PUT',
    body: JSON.stringify({ username }),
  });
}

export async function searchUsers(query: string): Promise<UserSearchResult[] | null> {
  return apiRequest(`/api/users/search?q=${encodeURIComponent(query)}`);
}

export async function getFriends(): Promise<Friend[] | null> {
  return apiRequest('/api/friends');
}

export async function getFriendRequests(): Promise<FriendRequest[] | null> {
  return apiRequest('/api/friends/requests');
}

export async function getSentRequests(): Promise<SentRequest[] | null> {
  return apiRequest('/api/friends/sent');
}

export async function sendFriendRequest(friendId: string): Promise<{ message: string } | null> {
  return apiRequest('/api/friends/request', {
    method: 'POST',
    body: JSON.stringify({ friendId }),
  });
}

export async function acceptFriendRequest(requestId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/friends/${requestId}/accept`, { method: 'PUT' });
}

export async function rejectFriendRequest(requestId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/friends/${requestId}/reject`, { method: 'PUT' });
}

export async function removeFriend(friendId: string): Promise<{ message: string } | null> {
  return apiRequest(`/api/friends/${friendId}`, { method: 'DELETE' });
}
