import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  isDevelopment,
  TOKEN_STORAGE_KEY,
  USER_STORAGE_KEY,
  EXPIRES_AT_STORAGE_KEY,
  SECURE_STORE_IOS_OPTIONS,
} from './auth-config';
import type { AuthUser } from './auth-config';

export async function getStoredToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY, SECURE_STORE_IOS_OPTIONS);
    if (token) return token;

    if (Platform.OS === 'ios') {
      const legacyToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY, {});
      if (legacyToken) {
        await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, legacyToken, SECURE_STORE_IOS_OPTIONS);
        return legacyToken;
      }
    }

    const oldKey = '@fromfeed:auth_token';
    const oldToken = await AsyncStorage.getItem(oldKey);
    if (oldToken) {
      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, oldToken, SECURE_STORE_IOS_OPTIONS);
      await AsyncStorage.removeItem(oldKey);
      return oldToken;
    }

    return null;
  } catch (error) {
    if (isDevelopment()) console.error('Error retrieving token from SecureStore:', error);
    return null;
  }
}

export async function storeToken(token: string): Promise<void> {
  if (typeof token !== 'string' || token.length === 0) {
    if (isDevelopment()) console.error('Attempted to store an invalid token:', token);
    return;
  }
  try {
    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token, SECURE_STORE_IOS_OPTIONS);
  } catch (error) {
    if (isDevelopment()) console.error('Error storing token in SecureStore:', error);
  }
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY, SECURE_STORE_IOS_OPTIONS);
    await SecureStore.deleteItemAsync(USER_STORAGE_KEY, SECURE_STORE_IOS_OPTIONS);
    await SecureStore.deleteItemAsync(EXPIRES_AT_STORAGE_KEY, SECURE_STORE_IOS_OPTIONS);
    // Clean up legacy AsyncStorage keys
    await AsyncStorage.multiRemove([TOKEN_STORAGE_KEY, '@fromfeed:user']);
  } catch (error) {
    if (isDevelopment()) console.error('Error clearing token:', error);
  }
}

export async function getStoredUser(): Promise<AuthUser | null> {
  try {
    const userJson = await SecureStore.getItemAsync(USER_STORAGE_KEY, SECURE_STORE_IOS_OPTIONS);
    if (userJson) return JSON.parse(userJson);

    // Migrate from legacy AsyncStorage
    const legacyJson = await AsyncStorage.getItem('@fromfeed:user');
    if (legacyJson) {
      const user: AuthUser = JSON.parse(legacyJson);
      await SecureStore.setItemAsync(USER_STORAGE_KEY, legacyJson, SECURE_STORE_IOS_OPTIONS);
      await AsyncStorage.removeItem('@fromfeed:user');
      return user;
    }

    return null;
  } catch (error) {
    if (isDevelopment()) console.error('Error retrieving stored user:', error);
    return null;
  }
}

export async function storeUser(user: AuthUser): Promise<void> {
  try {
    await SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(user), SECURE_STORE_IOS_OPTIONS);
  } catch (error) {
    if (isDevelopment()) console.error('Error storing user in SecureStore:', error);
  }
}

export async function getStoredExpiresAt(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(EXPIRES_AT_STORAGE_KEY, SECURE_STORE_IOS_OPTIONS);
  } catch {
    return null;
  }
}

export async function storeExpiresAt(expiresAt: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(EXPIRES_AT_STORAGE_KEY, expiresAt, SECURE_STORE_IOS_OPTIONS);
  } catch (error) {
    if (isDevelopment()) console.error('Error storing expiresAt in SecureStore:', error);
  }
}
