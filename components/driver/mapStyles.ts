/**
 * Dark theme map style for Google Maps
 * Applies premium dark appearance with bright accents for delivery zones
 */

export const DARK_MAP_STYLE = [
  {
    elementType: 'geometry',
    stylers: [
      {
        color: '#1E1E24',
      },
    ],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [
      {
        color: '#1E1E24',
      },
    ],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#D1D1D6',
      },
    ],
  },
  {
    featureType: 'administrative.country',
    elementType: 'geometry.stroke',
    stylers: [
      {
        color: '#3A3A44',
      },
    ],
  },
  {
    featureType: 'administrative.land_parcel',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#D1D1D6',
      },
    ],
  },
  {
    featureType: 'administrative.province',
    elementType: 'geometry.stroke',
    stylers: [
      {
        color: '#3A3A44',
      },
    ],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry.stroke',
    stylers: [
      {
        color: '#3A3A44',
      },
    ],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [
      {
        color: '#2A2A33',
      },
    ],
  },
  {
    featureType: 'landscape.natural.terrain',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#9CA3AF',
      },
    ],
  },
  {
    featureType: 'poi.attraction',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'poi.business',
    stylers: [
      {
        visibility: 'off',
      },
    ],
  },
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [
      {
        color: '#3A3A44',
      },
    ],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [
      {
        color: '#2A2A33',
      },
    ],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#D1D1D6',
      },
    ],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry.fill',
    stylers: [
      {
        color: '#4A4A53',
      },
    ],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.fill',
    stylers: [
      {
        color: '#5A5A63',
      },
    ],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [
      {
        color: '#3A3A44',
      },
    ],
  },
  {
    featureType: 'road.highway.controlled_access',
    elementType: 'geometry.stroke',
    stylers: [
      {
        color: '#3A3A44',
      },
    ],
  },
  {
    featureType: 'road.local',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#9CA3AF',
      },
    ],
  },
  {
    featureType: 'transit',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#9CA3AF',
      },
    ],
  },
  {
    featureType: 'water',
    elementType: 'geometry.fill',
    stylers: [
      {
        color: '#1A5A6F',
      },
    ],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [
      {
        color: '#6BA3B5',
      },
    ],
  },
];

/**
 * Get color intensity for hotspots based on demand level
 */
export const getHotspotColor = (intensity: number): string => {
  // intensity: 0-100
  if (intensity >= 80) return '#FF5722'; // High demand - bright orange
  if (intensity >= 60) return '#FF7043'; // Medium-high
  if (intensity >= 40) return '#FF8A65'; // Medium
  if (intensity >= 20) return '#FFAB91'; // Low-medium
  return '#673AB7'; // Low - purple accent
};

/**
 * Get hotspot opacity based on intensity
 */
export const getHotspotOpacity = (intensity: number): number => {
  // Scale from 0.2 to 0.6
  return 0.2 + (intensity / 100) * 0.4;
};
