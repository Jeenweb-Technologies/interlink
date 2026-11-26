import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = '@interlink_device_id';

/**
 * Returns a persistent unique device identifier for this mobile client.
 * Generated once and persisted in AsyncStorage.
 */
export const getDeviceId = async (): Promise<string> => {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }

    // Generate unique device ID
    const randomSuffix = Math.random().toString(36).substring(2, 10);
    const timeSuffix = Date.now().toString(36);
    const platformPrefix = Platform.OS === 'ios' ? 'ios' : 'android';
    const newId = `${platformPrefix}_dev_${randomSuffix}_${timeSuffix}`;

    await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
    return newId;
  } catch (error) {
    console.error('Error resolving device ID:', error);
    return `fallback_${Platform.OS}_${Date.now()}`;
  }
};

/**
 * Clears the stored device ID (e.g. on test reset)
 */
export const resetDeviceId = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(DEVICE_ID_KEY);
  } catch (error) {
    console.error('Error resetting device ID:', error);
  }
};
