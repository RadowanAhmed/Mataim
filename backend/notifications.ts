import { logger } from "@/backend/utils/logger";
// backend/notifications.ts
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Check if we're in Expo Go
const isExpoGo = Constants.appOwnership === 'expo';

// Configure notification handling behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false, // Disable sound in Expo Go
    shouldSetBadge: false,  // Disable badge in Expo Go
  }),
});

// Error handling function
const handleRegistrationError = (errorMessage: string) => {
  if (isExpoGo) {
    logger.debug('Push notifications not available in Expo Go');
    return;
  }
  console.error('Push notification registration error:', errorMessage);
};

export async function registerForPushNotificationsAsync() {
  // Skip push notifications in Expo Go
  if (isExpoGo) {
    logger.debug('Skipping push notifications in Expo Go - Use development build for full functionality');
    return null;
  }

  let token;

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      handleRegistrationError('Permission not granted for push notifications');
      return null;
    }

    // Get projectId from app config
    const projectId = 
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.manifest?.extra?.eas?.projectId;

    logger.debug('Project ID:', projectId);

    if (!projectId) {
      handleRegistrationError('No "projectId" found in app configuration.');
      return null;
    }

    try {
      // Get push token with projectId
      token = (await Notifications.getExpoPushTokenAsync({
        projectId,
      })).data;
      
      logger.debug('Push token obtained successfully:', token);
    } catch (error: any) {
      handleRegistrationError(`Failed to get push token: ${error.message}`);
      return null;
    }
  } else {
    handleRegistrationError('Must use physical device for Push Notifications');
    return null;
  }

  // Android specific configuration
  if (Platform.OS === 'android') {
    try {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    } catch (error: any) {
      console.error('Failed to set Android notification channel:', error);
    }
  }

  return token;
}

// Save push token to Supabase
export async function savePushToken(userId: string, token: string) {
  try {
    const { error } = await supabase
      .from('user_devices')
      .upsert({ 
        user_id: userId, 
        push_token: token,
        device_type: Platform.OS,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error saving push token:', error);
    } else {
      logger.debug('Push token saved successfully');
    }
  } catch (error) {
    console.error('Error in savePushToken:', error);
  }
}

// Mock function for Expo Go that simulates push notifications
export const simulatePushNotification = async (userId: string, notification: any) => {
  if (isExpoGo) {
    logger.debug('🔔 SIMULATED PUSH NOTIFICATION (Expo Go):', {
      title: notification.title,
      body: notification.body,
      userId: userId
    });
    
    // Show a local notification instead
    await Notifications.scheduleNotificationAsync({
      content: {
        title: notification.title + " 📱 (Simulated)",
        body: notification.body,
        data: notification.data || {},
      },
      trigger: { seconds: 1 },
    });
    
    return { success: true, simulated: true };
  }
  
  return { success: false, simulated: false };
};