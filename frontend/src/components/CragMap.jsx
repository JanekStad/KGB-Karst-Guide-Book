import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polygon, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { sectorsAPI } from '../services/api';
import './CragMap.css';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Component to handle map bounds fitting (only on initial load)
function MapBounds({ sectorsWithCoords, shouldFitBounds }) {
  const map = useMap();
  const hasFittedBoundsRef = useRef(false);

  useEffect(() => {
    // Only fit bounds once when requested and sectors are available
    if (shouldFitBounds && sectorsWithCoords.length > 0 && !hasFittedBoundsRef.current) {
      // Use setTimeout to ensure map is fully initialized
      const timeoutId = setTimeout(() => {
        if (!hasFittedBoundsRef.current && sectorsWithCoords.length > 0) {
          const bounds = L.latLngBounds(
            sectorsWithCoords.map((sector) => [
              parseFloat(sector.latitude),
              parseFloat(sector.longitude),
            ])
          );
          map.fitBounds(bounds, { padding: [50, 50] });
          hasFittedBoundsRef.current = true;
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, shouldFitBounds]);

  return null;
}

// Component to track zoom level
function ZoomHandler({ onZoomChange }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

// Helper function to create a simple polygon around a point
// This creates a square polygon centered on the lat/lng point
// In production, you'd use actual polygon coordinates from the backend
function createSectorPolygon(latitude, longitude, size = 0.0015) {
  // Create a square polygon around the center point
  // size is in degrees (approximately 150m for 0.0015)
  const halfSize = size / 2;
  return [
    [latitude + halfSize, longitude - halfSize], // Top-left
    [latitude + halfSize, longitude + halfSize], // Top-right
    [latitude - halfSize, longitude + halfSize], // Bottom-right
    [latitude - halfSize, longitude - halfSize], // Bottom-left
    [latitude + halfSize, longitude - halfSize], // Close the polygon
  ];
}

// Helper function to calculate polygon centroid
function getPolygonCentroid(coordinates) {
  if (!coordinates || coordinates.length === 0) return null;
  
  // Remove duplicate closing point if present
  const coords = coordinates[0] === coordinates[coordinates.length - 1] 
    ? coordinates.slice(0, -1) 
    : coordinates;
  
  let latSum = 0;
  let lngSum = 0;
  
  coords.forEach((coord) => {
    latSum += coord[0];
    lngSum += coord[1];
  });
  
  return [latSum / coords.length, lngSum / coords.length];
}

// Component to display text label on map
function SectorLabel({ position, name }) {
  const map = useMap();
  const markerRef = useRef(null);
  
  useEffect(() => {
    if (!position || !map) return;
    
    // Create custom div icon for text label with inline styles
    const icon = L.divIcon({
      className: 'sector-label',
      html: `<div style="
        background-color: rgba(30, 41, 59, 0.95);
        color: #ffffff;
        padding: 0.4rem 0.75rem;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 700;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.3);
        border: 2px solid rgba(255, 255, 255, 0.5);
        text-align: center;
        pointer-events: none;
        user-select: none;
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
        letter-spacing: 0.02em;
        line-height: 1.2;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      ">${name}</div>`,
      iconSize: [150, 30],
      iconAnchor: [50, 15],
    });
    
    // Create marker for label
    const marker = L.marker(position, { 
      icon,
      interactive: false, // Don't interfere with polygon clicks
      zIndexOffset: 1000, // Ensure labels appear above polygons
    }).addTo(map);
    
    markerRef.current = marker;
    
    return () => {
      if (markerRef.current) {
        map.removeLayer(markerRef.current);
        markerRef.current = null;
      }
    };
  }, [map, position, name]);
  
  return null;
}

const CragMap = ({ crags }) => {
  const navigate = useNavigate();
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(11);
  const [shouldFitInitialBounds, setShouldFitInitialBounds] = useState(false);

  // Moravsky kras region center coordinates
  const defaultCenter = [49.4, 16.7];
  const defaultZoom = 11;

  // Show polygons when zoomed in (zoom level >= 13)
  const showPolygons = zoomLevel >= 13;

  // Fetch sectors when component mounts
  useEffect(() => {
    fetchSectors();
  }, []);

  const fetchSectors = async () => {
    try {
      console.log('📡 Fetching sectors for map...');
      const response = await sectorsAPI.list();
      console.log('✅ Sectors fetched successfully:', response.data);
      const fetchedSectors = response.data.results || response.data;
      setSectors(fetchedSectors || []);
      // Mark that we should fit bounds on initial load (only once)
      setShouldFitInitialBounds(true);
    } catch (err) {
      console.error('❌ Failed to fetch sectors:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter sectors that have coordinates (memoized to prevent unnecessary recalculations)
  const sectorsWithCoords = useMemo(
    () => sectors.filter((sector) => sector.latitude && sector.longitude),
    [sectors]
  );

  const handleMarkerClick = (sectorId) => {
    navigate(`/sectors/${sectorId}`);
  };

  const handlePolygonClick = (sectorId) => {
    navigate(`/sectors/${sectorId}`);
  };

  if (loading) {
    return (
      <div className="crag-map-container">
        <div className="map-empty-state">
          <p>Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="crag-map-container">
      {sectorsWithCoords.length === 0 ? (
        <div className="map-empty-state">
          <p>No sectors with coordinates available.</p>
          <p className="map-empty-hint">Add coordinates to sectors to see them on the map.</p>
        </div>
      ) : (
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBounds 
            sectorsWithCoords={sectorsWithCoords} 
            shouldFitBounds={shouldFitInitialBounds && !loading}
          />
          <ZoomHandler onZoomChange={setZoomLevel} />
          
          {/* Render polygons when zoomed in */}
          {showPolygons &&
            sectorsWithCoords.map((sector) => {
              const lat = parseFloat(sector.latitude);
              const lng = parseFloat(sector.longitude);
              // Use polygon_boundary if available, otherwise create a placeholder polygon
              const polygonCoords = sector.polygon_boundary 
                ? sector.polygon_boundary 
                : createSectorPolygon(lat, lng);
              
              // Calculate centroid for label placement
              const centroid = getPolygonCentroid(polygonCoords) || [lat, lng];
              
              return (
                <Polygon
                  key={`polygon-${sector.id}`}
                  positions={polygonCoords}
                  pathOptions={{
                    color: '#1E293B',
                    fillColor: '#334155',
                    fillOpacity: 0.5,
                    weight: 1,
                  }}
                  eventHandlers={{
                    click: () => handlePolygonClick(sector.id),
                    mouseover: (e) => {
                      const layer = e.target;
                      layer.setStyle({
                        fillOpacity: 0.5,
                        weight: 3,
                      });
                    },
                    mouseout: (e) => {
                      const layer = e.target;
                      layer.setStyle({
                        fillOpacity: 0.5,
                        weight: 2,
                      });
                    },
                  }}
                >
                  <Popup>
                    <div className="map-popup">
                      <h3>{sector.name}</h3>
                      <p className="map-popup-area">{sector.area_name || 'Unknown Area'}</p>
                      <p className="map-popup-stats">
                        {sector.problem_count || 0} problem{(sector.problem_count || 0) !== 1 ? 's' : ''}
                      </p>
                      <button
                        onClick={() => handlePolygonClick(sector.id)}
                        className="map-popup-button"
                      >
                        View Sector
                      </button>
                    </div>
                  </Popup>
                </Polygon>
              );
            })}
          
          {/* Render sector labels when zoomed in */}
          {showPolygons &&
            sectorsWithCoords.map((sector) => {
              const lat = parseFloat(sector.latitude);
              const lng = parseFloat(sector.longitude);
              const polygonCoords = sector.polygon_boundary 
                ? sector.polygon_boundary 
                : createSectorPolygon(lat, lng);
              const centroid = getPolygonCentroid(polygonCoords) || [lat, lng];
              
              return (
                <SectorLabel 
                  key={`label-${sector.id}`}
                  position={centroid} 
                  name={sector.name} 
                />
              );
            })}
          
          {/* Render markers when not zoomed in or as fallback */}
          {!showPolygons &&
            sectorsWithCoords.map((sector) => (
              <Marker
                key={sector.id}
                position={[parseFloat(sector.latitude), parseFloat(sector.longitude)]}
                eventHandlers={{
                  click: () => handleMarkerClick(sector.id),
                }}
              >
                <Popup>
                  <div className="map-popup">
                    <h3>{sector.name}</h3>
                    <p className="map-popup-area">{sector.area_name || 'Unknown Area'}</p>
                    <p className="map-popup-stats">
                      {sector.problem_count || 0} problem{(sector.problem_count || 0) !== 1 ? 's' : ''}
                    </p>
                    <button
                      onClick={() => handleMarkerClick(sector.id)}
                      className="map-popup-button"
                    >
                      View Sector
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
        </MapContainer>
      )}
    </div>
  );
};

export default CragMap;

