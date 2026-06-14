/**
 * LazyMapView - Direct imports from react-native-maps
 * Fixed Class constructor invocation issue
 */

import React, { useRef } from "react";
import MapView from "react-native-maps";
import { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

interface LazyMapViewProps {
  [key: string]: any;
}

// Re-export the constants and components
export { PROVIDER_GOOGLE };

/**
 * LazyMapView - Renders MapView directly
 */
export const LazyMapView = React.forwardRef<any, LazyMapViewProps>((props, ref) => {
  const internalRef = useRef(null);

  return <MapView ref={ref || internalRef} {...props} />;
});

LazyMapView.displayName = "LazyMapView";

/**
 * LazyMarker - Direct Marker from react-native-maps
 */
export const LazyMarker: React.FC<LazyMapViewProps> = (props) => {
  return <Marker {...props} />;
};

/**
 * LazyPolyline - Direct Polyline from react-native-maps
 */
export const LazyPolyline: React.FC<LazyMapViewProps> = (props) => {
  return <Polyline {...props} />;
};
