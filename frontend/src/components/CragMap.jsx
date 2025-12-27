import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polygon, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { useNavigate } from 'react-router-dom';
import { areasAPI, sectorsAPI } from '../services/api';
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

// Component to handle area selection and zoom
function AreaZoomHandler({ selectedAreaCoords, onZoomComplete }) {
  const map = useMap();
  const hasZoomedRef = useRef(false);

  useEffect(() => {
    if (selectedAreaCoords && !hasZoomedRef.current) {
      hasZoomedRef.current = true;
      map.setView(selectedAreaCoords, 15, { animate: true });
      
      // Reset after zoom completes
      map.once('zoomend', () => {
        setTimeout(() => {
          hasZoomedRef.current = false;
          if (onZoomComplete) {
            onZoomComplete();
          }
        }, 100);
      });
    }
  }, [map, selectedAreaCoords, onZoomComplete]);

  return null;
}

// Helper function to generate a circular polygon from center point and radius
function createCirclePolygon(latitude, longitude, radiusMeters, numPoints = 32) {
  // Convert radius from meters to degrees
  // 1 degree of latitude ≈ 111,000 meters (constant)
  // 1 degree of longitude ≈ 111,000 * cos(latitude) meters (varies by latitude)
  const radiusLatDegrees = radiusMeters / 111000.0;
  const radiusLngDegrees = radiusMeters / (111000.0 * Math.cos(latitude * Math.PI / 180));

  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (2 * Math.PI * i) / numPoints;
    const lat = latitude + radiusLatDegrees * Math.cos(angle);
    const lng = longitude + radiusLngDegrees * Math.sin(angle);
    points.push([lat, lng]);
  }
  
  // Close the polygon by adding the first point at the end
  if (points.length > 0) {
    points.push([points[0][0], points[0][1]]);
  }
  
  return points;
}

// Helper function to create a simple polygon around a point (fallback)
// This creates a square polygon centered on the lat/lng point
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

// Helper function to calculate label position at the edge of a circle
// Positioned at 2 o'clock (30 degrees from east/3 o'clock, or 60 degrees clockwise from north/12 o'clock)
function calculateLabelPositionAtEdge(centerLat, centerLng, radiusMeters) {
  // Convert radius from meters to degrees
  // Same calculation as in createCirclePolygon
  const radiusLatDegrees = radiusMeters / 111000.0;
  const radiusLngDegrees = radiusMeters / (111000.0 * Math.cos(centerLat * Math.PI / 180));
  
  // 2 o'clock position: 30 degrees from east (3 o'clock)
  // In standard polar coordinates: 0° = east (3 o'clock), positive = counter-clockwise
  // 2 o'clock = 30° (or -30° from north)
  const angleRadians = (30 * Math.PI) / 180;
  
  // Calculate edge position
  const lat = centerLat + radiusLatDegrees * Math.cos(angleRadians);
  const lng = centerLng + radiusLngDegrees * Math.sin(angleRadians);
  
  return [lat, lng];
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

// Component to display area label on map
function AreaLabel({ position, name }) {
  const map = useMap();
  const markerRef = useRef(null);
  
  useEffect(() => {
    if (!position || !map) return;
    
    // Create custom div icon for area label with inline styles (matching sector color scheme)
    const icon = L.divIcon({
      className: 'area-label',
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

const CragMap = ({ crags: _crags, problems, sectors: sectorsProp, selectedProblem, selectedSector, onProblemSelect, onSectorSelect }) => {
  const navigate = useNavigate();
  const [sectors, setSectors] = useState([]);
  const [areas, setAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [areaToZoom, setAreaToZoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(11);
  const [shouldFitInitialBounds, setShouldFitInitialBounds] = useState(false);

  // Moravsky kras region center coordinates
  const defaultCenter = [49.4, 16.7];
  const defaultZoom = 11;

  // Show areas when zoomed out (zoom level < 15)
  // Show sectors when zoomed in (zoom level >= 15)
  const showAreas = zoomLevel < 15;
  const showPolygons = zoomLevel >= 15;

  // Calculate hasProblems early (only depends on props, not state)
  const hasProblems = problems && problems.length > 0;

  // Fetch areas on initial load
  useEffect(() => {
    fetchAreas();
  }, []);

  // Use sectors from props if provided, otherwise fetch
  useEffect(() => {
    if (sectorsProp && sectorsProp.length > 0) {
      setSectors(sectorsProp);
      setLoading(false);
      setShouldFitInitialBounds(true);
    } else if (!problems || problems.length === 0) {
      // Only fetch sectors if we're not showing areas (i.e., zoomed in)
      if (!showAreas) {
        fetchSectors();
      } else {
        setLoading(false);
        setShouldFitInitialBounds(true);
      }
    } else {
      setLoading(false);
      setShouldFitInitialBounds(true);
    }
  }, [sectorsProp, problems, showAreas]);

  // Fetch sectors when area is selected or when zoomed in
  useEffect(() => {
    if (selectedArea && showPolygons) {
      fetchSectorsForArea(selectedArea.id);
    } else if (showPolygons && !selectedArea && !sectorsProp && !hasProblems) {
      fetchSectors();
    }
  }, [selectedArea, showPolygons, sectorsProp, hasProblems]);

  // Clear selected area when zooming out
  useEffect(() => {
    if (showAreas && selectedArea) {
      setSelectedArea(null);
      // Don't clear sectors here - they might be needed when zooming back in
    }
  }, [showAreas, selectedArea]);

  const fetchAreas = async () => {
    try {
      console.log('📡 Fetching areas for map...');
      const response = await areasAPI.list();
      console.log('✅ Areas fetched successfully:', response.data);
      const fetchedAreas = response.data.results || response.data;
      setAreas(fetchedAreas || []);
      console.log('📍 Total areas loaded:', fetchedAreas?.length || 0);
    } catch (err) {
      console.error('❌ Failed to fetch areas:', err);
    }
  };

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

  const fetchSectorsForArea = async (areaId) => {
    try {
      console.log('📡 Fetching sectors for area:', areaId);
      setLoading(true);
      const response = await areasAPI.getSectors(areaId);
      console.log('✅ Sectors fetched successfully:', response.data);
      const fetchedSectors = response.data.results || response.data;
      setSectors(fetchedSectors || []);
      setShouldFitInitialBounds(true);
    } catch (err) {
      console.error('❌ Failed to fetch sectors for area:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get coordinates from problem (from sector)
  const getProblemCoordinates = (problem) => {
    const sector = problem.sector_detail || problem.sector;
    if (sector?.latitude && sector?.longitude) {
      return [parseFloat(sector.latitude), parseFloat(sector.longitude)];
    }
    return null;
  };

  // Filter problems that have coordinates
  const problemsWithCoords = useMemo(() => {
    if (!problems || problems.length === 0) return [];
    return problems.filter(problem => getProblemCoordinates(problem) !== null);
  }, [problems]);


  // Filter sectors that have coordinates (memoized to prevent unnecessary recalculations)
  const sectorsWithCoords = useMemo(
    () => sectors.filter((sector) => sector.latitude && sector.longitude),
    [sectors]
  );

  // Filter areas that have coordinates (use direct lat/lng or fallback to avg)
  const areasWithCoords = useMemo(() => {
    const filtered = areas.filter((area) => {
      const lat = area.latitude || area.avg_latitude;
      const lng = area.longitude || area.avg_longitude;
      return lat && lng;
    });
    console.log('🗺️ Areas with coordinates:', filtered.length, 'out of', areas.length);
    return filtered;
  }, [areas]);

  // Get coordinates for an area (prefer direct coordinates, fallback to avg)
  const getAreaCoordinates = (area) => {
    const lat = area.latitude || area.avg_latitude;
    const lng = area.longitude || area.avg_longitude;
    if (lat && lng) {
      return [parseFloat(lat), parseFloat(lng)];
    }
    return null;
  };

  // Determine what to display (calculate after useMemos)
  const hasSectors = sectorsWithCoords.length > 0;
  const hasAreas = areasWithCoords.length > 0;
  const hasData = hasProblems ? problemsWithCoords.length > 0 : (hasSectors || hasAreas);

  // Debug logging
  useEffect(() => {
    console.log('🗺️ Map state:', {
      zoomLevel,
      showAreas,
      showPolygons,
      areasCount: areas.length,
      areasWithCoordsCount: areasWithCoords.length,
      sectorsCount: sectors.length,
      sectorsWithCoordsCount: sectorsWithCoords.length,
      hasProblems,
      hasSectors,
      hasAreas,
      hasData,
    });
  }, [zoomLevel, showAreas, showPolygons, areas.length, areasWithCoords.length, sectors.length, sectorsWithCoords.length, hasProblems, hasSectors, hasAreas, hasData]);

  // Get bounds for problems
  const _problemsBounds = useMemo(() => {
    if (problemsWithCoords.length === 0) return null;
    const coords = problemsWithCoords
      .map(problem => getProblemCoordinates(problem))
      .filter(coord => coord !== null);
    if (coords.length === 0) return null;
    return L.latLngBounds(coords);
  }, [problemsWithCoords]);

  const handleMarkerClick = (sectorId) => {
    if (onSectorSelect) {
      const sector = sectorsWithCoords.find(s => s.id === sectorId);
      if (sector) {
        onSectorSelect(sector);
      }
    }
    navigate(`/sectors/${sectorId}`);
  };

  const handlePolygonClick = (sectorId) => {
    if (onSectorSelect) {
      const sector = sectorsWithCoords.find(s => s.id === sectorId);
      if (sector) {
        onSectorSelect(sector);
      }
    }
    navigate(`/sectors/${sectorId}`);
  };

  const handleAreaClick = (areaId) => {
    const area = areasWithCoords.find(a => a.id === areaId);
    if (!area) return;

    // Set selected area
    setSelectedArea(area);

    // Get area coordinates and trigger zoom
    const coords = getAreaCoordinates(area);
    if (coords) {
      setAreaToZoom(coords);
    }

    // Fetch sectors for this area
    fetchSectorsForArea(areaId);
  };

  const handleZoomComplete = () => {
    setAreaToZoom(null);
  };

  const handleProblemMarkerClick = (problem) => {
    if (onProblemSelect) {
      onProblemSelect(problem);
    } else {
      navigate(`/problems/${problem.id}`);
    }
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
      {!hasData ? (
        <div className="map-empty-state">
          <p>{hasProblems ? 'No problems with coordinates available.' : 'No areas or sectors with coordinates available.'}</p>
          <p className="map-empty-hint">Add coordinates to see them on the map.</p>
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
          {hasProblems && problemsWithCoords.length > 0 ? (
            <MapBounds 
              sectorsWithCoords={problemsWithCoords
                .map(p => {
                  const coords = getProblemCoordinates(p);
                  return coords ? { latitude: coords[0], longitude: coords[1] } : null;
                })
                .filter(c => c !== null)} 
              shouldFitBounds={shouldFitInitialBounds && !loading}
            />
          ) : hasSectors ? (
            <MapBounds 
              sectorsWithCoords={sectorsWithCoords} 
              shouldFitBounds={shouldFitInitialBounds && !loading}
            />
          ) : hasAreas && showAreas ? (
            <MapBounds 
              sectorsWithCoords={areasWithCoords.map(area => {
                const coords = getAreaCoordinates(area);
                return coords ? { latitude: coords[0], longitude: coords[1] } : null;
              }).filter(c => c !== null)} 
              shouldFitBounds={shouldFitInitialBounds && !loading}
            />
          ) : null}
          <ZoomHandler onZoomChange={setZoomLevel} />
          {areaToZoom && <AreaZoomHandler selectedAreaCoords={areaToZoom} onZoomComplete={handleZoomComplete} />}
          
          {/* Render areas when zoomed out (only if no problems) */}
          {showAreas && areasWithCoords.length > 0 && !hasProblems && areasWithCoords.map((area) => {
            const coords = getAreaCoordinates(area);
            if (!coords) return null;
            const lat = coords[0];
            const lng = coords[1];
            
            // Create a larger circle for areas (default radius ~500m)
            const areaRadius = 500;
            const polygonCoords = createCirclePolygon(lat, lng, areaRadius);
            // Calculate label position at edge of circle (2 o'clock)
            const labelPosition = calculateLabelPositionAtEdge(lat, lng, areaRadius);
            
            return (
              <div key={`area-${area.id}`}>
                <Polygon
                  positions={polygonCoords}
                  pathOptions={{
                    color: '#1E293B',
                    fillColor: '#334155',
                    fillOpacity: 0.5,
                    weight: 1,
                  }}
                  eventHandlers={{
                    click: () => handleAreaClick(area.id),
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
                        weight: 1,
                      });
                    },
                  }}
                >
                  <Popup>
                    <div className="map-popup">
                      <h3>{area.name}</h3>
                      <p className="map-popup-area">{area.city_name || 'Unknown City'}</p>
                      <p className="map-popup-stats">
                        {area.sector_count || 0} sector{(area.sector_count || 0) !== 1 ? 's' : ''} • {area.problem_count || 0} problem{(area.problem_count || 0) !== 1 ? 's' : ''}
                      </p>
                      <button
                        onClick={() => handleAreaClick(area.id)}
                        className="map-popup-button"
                      >
                        View Area
                      </button>
                    </div>
                  </Popup>
                </Polygon>
                <AreaLabel 
                  position={labelPosition} 
                  name={area.name}
                />
              </div>
            );
          })}
          
          {/* Render problem markers if using problems */}
          {hasProblems && problemsWithCoords.map((problem) => {
            const coords = getProblemCoordinates(problem);
            if (!coords) return null;
            const isSelected = selectedProblem?.id === problem.id;
            
            // Create custom icon for selected problem with pulse
            const icon = L.divIcon({
              className: `problem-marker ${isSelected ? 'marker-pulse' : ''}`,
              html: `
                <div class="marker-container">
                  ${isSelected ? '<div class="marker-pulse-ring"></div>' : ''}
                  <div class="marker-dot ${isSelected ? 'marker-dot-selected' : ''}"></div>
                </div>
              `,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            });
            
            return (
              <Marker
                key={problem.id}
                position={coords}
                icon={icon}
                eventHandlers={{
                  click: () => handleProblemMarkerClick(problem),
                }}
              >
                <Popup>
                  <div className="map-popup">
                    <h3>{problem.name}</h3>
                    <p className="map-popup-area">
                      {(problem.sector_detail || problem.sector)?.name || problem.area_name || 'Unknown Location'}
                    </p>
                    <p className="map-popup-stats">
                      Grade: {problem.grade || 'N/A'}
                    </p>
                    <button
                      onClick={() => handleProblemMarkerClick(problem)}
                      className="map-popup-button"
                    >
                      View Problem
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
          
          {/* Render polygons when zoomed in (only if not showing areas) */}
          {showPolygons && !showAreas &&
            sectorsWithCoords.map((sector) => {
              const lat = parseFloat(sector.latitude);
              const lng = parseFloat(sector.longitude);
              // Priority: polygon_boundary > radius_meters > fallback square
              let polygonCoords;
              if (sector.polygon_boundary) {
                polygonCoords = sector.polygon_boundary;
              } else if (sector.radius_meters || sector.radiusMeters) {
                const radius = sector.radius_meters || sector.radiusMeters;
                polygonCoords = createCirclePolygon(lat, lng, parseFloat(radius));
              } else {
                polygonCoords = createSectorPolygon(lat, lng);
              }
              
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
          
          {/* Render sector labels when zoomed in (only if not showing areas) */}
          {showPolygons && !showAreas &&
            sectorsWithCoords.map((sector) => {
              const lat = parseFloat(sector.latitude);
              const lng = parseFloat(sector.longitude);
              // Priority: polygon_boundary > radius_meters > fallback square
              let polygonCoords;
              let labelPosition;
              if (sector.polygon_boundary) {
                polygonCoords = sector.polygon_boundary;
                // For polygon_boundary, use centroid since it's not a circle
                labelPosition = getPolygonCentroid(polygonCoords) || [lat, lng];
              } else if (sector.radius_meters || sector.radiusMeters) {
                const radius = sector.radius_meters || sector.radiusMeters;
                polygonCoords = createCirclePolygon(lat, lng, parseFloat(radius));
                // For circles, calculate position at edge (2 o'clock)
                labelPosition = calculateLabelPositionAtEdge(lat, lng, parseFloat(radius));
              } else {
                polygonCoords = createSectorPolygon(lat, lng);
                // For fallback square, use centroid
                labelPosition = getPolygonCentroid(polygonCoords) || [lat, lng];
              }
              
              return (
                <SectorLabel 
                  key={`label-${sector.id}`}
                  position={labelPosition} 
                  name={sector.name} 
                />
              );
            })}
          
          {/* Render sector markers when not zoomed in or as fallback (only if not showing areas) */}
          {!showPolygons && !showAreas &&
            sectorsWithCoords.map((sector) => {
              const isSelected = selectedSector?.id === sector.id;
              
              // Create custom icon for selected sector with pulse
              const icon = L.divIcon({
                className: `problem-marker ${isSelected ? 'marker-pulse' : ''}`,
                html: `
                  <div class="marker-container">
                    ${isSelected ? '<div class="marker-pulse-ring"></div>' : ''}
                    <div class="marker-dot ${isSelected ? 'marker-dot-selected' : ''}"></div>
                  </div>
                `,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              });
              
              return (
                <Marker
                  key={sector.id}
                  position={[parseFloat(sector.latitude), parseFloat(sector.longitude)]}
                  icon={icon}
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
              );
            })}
        </MapContainer>
      )}
    </div>
  );
};

export default CragMap;

