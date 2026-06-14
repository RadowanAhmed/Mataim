import { logger } from "@/backend/utils/logger";
// backend/firebase-service.js
import { FCM_SERVER_KEY } from './firebase-config';
import { supabase } from './supabase';

class FirebaseService {
  constructor() {
    this.serverKey = FCM_SERVER_KEY;
    this.initialized = false;
  }

  async initialize() {
    try {
      if (!this.serverKey || this.serverKey === "AAAA...:APA91b...") {
        console.warn('FCM Server Key not configured. Please update firebase-config.js');
        return false;
      }
      
      this.initialized = true;
      logger.debug('Firebase Service initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing Firebase Service:', error);
      return false;
    }
  }

  async sendToDevice(pushToken, notification, data = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    // For Expo, we use Expo's push service
    const message = {
      to: pushToken,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: {
        ...data,
        _displayInForeground: true,
      },
    };

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      const result = await response.json();
      
      if (result.data && result.data.status === 'ok') {
        logger.debug('Push notification sent successfully');
        return { success: true, result };
      } else {
        console.error('Push notification failed:', result);
        return { success: false, error: result };
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
      return { success: false, error };
    }
  }

  async sendToUser(userId, notification, data = {}) {
    try {
      // Get user's device tokens
      const { data: devices, error } = await supabase
        .from('user_devices')
        .select('push_token')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching user devices:', error);
        return { success: false, error };
      }

      if (!devices || devices.length === 0) {
        logger.debug('No active devices found for user:', userId);
        return { success: false, error: 'No devices found' };
      }

      // Send to all user's devices
      const results = await Promise.all(
        devices.map(device => 
          this.sendToDevice(device.push_token, notification, data)
        )
      );

      logger.debug(`Sent notifications to ${devices.length} devices for user ${userId}`);
      return { success: true, results };
    } catch (error) {
      console.error('Error in sendToUser:', error);
      return { success: false, error };
    }
  }
}

export const firebaseService = new FirebaseService();