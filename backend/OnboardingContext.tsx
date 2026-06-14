import { logger } from "@/backend/utils/logger";
// backend/OnboardingContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { STARTUP_TIMEOUTS, runStartupTask } from './utils/startupDiagnostics';

interface OnboardingContextType {
  hasCompletedOnboarding: boolean;
  completeOnboarding: () => Promise<void>;
  resetOnboarding: () => Promise<void>; // Optional: Add reset functionality
  isLoading: boolean;
}

const OnboardingContext = createContext<OnboardingContextType>({} as OnboardingContextType);

export const OnboardingProvider = ({ children }: { children: React.ReactNode }) => {
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      logger.debug('Checking onboarding status...');
      const value = await runStartupTask(
        'onboarding:read-status',
        () => AsyncStorage.getItem('hasCompletedOnboarding'),
        STARTUP_TIMEOUTS.onboardingStorage,
        null,
      );
      const completed = value === 'true';
      logger.debug('Onboarding status:', completed ? 'completed' : 'not completed');
      setHasCompletedOnboarding(completed);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setHasCompletedOnboarding(false);
    } finally {
      setIsLoading(false);
    }
  };

  const completeOnboarding = async () => {
    try {
      logger.debug('Completing onboarding...');
      await AsyncStorage.setItem('hasCompletedOnboarding', 'true');
      setHasCompletedOnboarding(true);
      logger.debug('Onboarding marked as completed');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      throw error; // Optional: re-throw error if you want to handle it in components
    }
  };

  // Optional: Add reset functionality for testing or logout
  const resetOnboarding = async () => {
    try {
      logger.debug('Resetting onboarding...');
      await AsyncStorage.removeItem('hasCompletedOnboarding');
      setHasCompletedOnboarding(false);
      logger.debug('Onboarding reset');
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      throw error;
    }
  };

  return (
    <OnboardingContext.Provider
      value={{
        hasCompletedOnboarding,
        completeOnboarding,
        resetOnboarding, // Include if you add the function
        isLoading,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
};
