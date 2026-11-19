// Pushe (pushe.co) on Android builds that include it; null in Expo Go, on iOS and on the web.
import { requireOptionalNativeModule } from 'expo';

interface BaselinePushe {
  isRegistered(): boolean;
  getDeviceId(timeoutMs: number): Promise<string | null>;
}

export const Pushe = requireOptionalNativeModule<BaselinePushe>('BaselinePushe');
