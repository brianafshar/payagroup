/* global jest */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: [] })) }));
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getExpoPushTokenAsync: jest.fn(),
  getLastNotificationResponse: jest.fn(() => null),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  AndroidImportance: { HIGH: 4 },
}));
jest.mock('expo-device', () => ({ isDevice: false }));
jest.mock('expo-secure-store', () => {
  const m = new Map();
  return {
    getItemAsync: jest.fn(async (k) => m.get(k) ?? null),
    setItemAsync: jest.fn(async (k, v) => void m.set(k, v)),
    deleteItemAsync: jest.fn(async (k) => void m.delete(k)),
  };
});
