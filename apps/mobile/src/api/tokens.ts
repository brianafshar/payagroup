/**
 * Token storage: the Keychain / Keystore through expo-secure-store on phones; AsyncStorage on the web
 * build (SecureStore isn't available there).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface Tokens {
  access: string;
  refresh: string;
}

const KEY = 'bl.tokens';
let cache: Tokens | null = null;

export async function loadTokens(): Promise<Tokens | null> {
  try {
    const raw = Platform.OS === 'web' ? await AsyncStorage.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    cache = raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    cache = null;
  }
  return cache;
}

export function getTokens(): Tokens | null {
  return cache;
}

export async function saveTokens(t: Tokens | null): Promise<void> {
  cache = t;
  try {
    if (Platform.OS === 'web') {
      if (t) await AsyncStorage.setItem(KEY, JSON.stringify(t));
      else await AsyncStorage.removeItem(KEY);
    } else if (t) await SecureStore.setItemAsync(KEY, JSON.stringify(t));
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* kept in memory for this session */
  }
}
