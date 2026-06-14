import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { RealTimeLocationService } from "./services/RealTimeLocationService";
import { supabase } from "./supabase";

interface LocationData {
  latitude: string;
  longitude: string;
  accuracy?: string;
  timestamp: string;
}

interface DriverLocation {
  driver_id: string;
  location: LocationData;
  order_id: string;
}

interface LocationContextType {
  driverLocations: Map<string, DriverLocation>;
  updateDriverLocation: (driverId: string, location: LocationData) => void;
  startTracking: (userId: string, orderId?: string | null) => Promise<boolean>;
  stopTracking: () => void;
  isTracking: boolean;
  subscribeToDriverLocation: (orderId: string) => () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error("useLocation must be used within LocationProvider");
  }
  return context;
};

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [driverLocations, setDriverLocations] = useState<Map<string, DriverLocation>>(new Map());
  const [isTracking, setIsTracking] = useState(false);

  const updateDriverLocation = (driverId: string, location: LocationData) => {
    setDriverLocations((prev) => {
      const next = new Map(prev);
      const currentOrderId = Array.from(prev.values()).find((d) => d.driver_id === driverId)?.order_id || "";

      next.set(driverId, {
        driver_id: driverId,
        location,
        order_id: currentOrderId,
      });

      return next;
    });
  };

  const startTracking = async (userId: string, orderId?: string | null): Promise<boolean> => {
    const result = await RealTimeLocationService.startTracking(userId, orderId);
    const success = Boolean(result?.success);
    setIsTracking(success);
    return success;
  };

  const stopTracking = () => {
    RealTimeLocationService.stopTracking();
    setIsTracking(false);
  };

  const subscribeToDriverLocation = (orderId: string) => {
    const channel = supabase.channel(`location-updates-${orderId}`);

    channel
      .on("broadcast", { event: "location_update" }, (payload: any) => {
        const { driver_id, location } = payload.payload || {};
        if (driver_id && location) updateDriverLocation(driver_id, location);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  return (
    <LocationContext.Provider
      value={{
        driverLocations,
        updateDriverLocation,
        startTracking,
        stopTracking,
        isTracking,
        subscribeToDriverLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};
