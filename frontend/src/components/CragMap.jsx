import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { sectorsAPI } from '../services/api';
import 'leaflet/dist/leaflet.css';
import './CragMap.css';

// Fix for default marker icons in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Component to handle map bounds fitting
function MapBounds({ sectorsWithCoords }) {
  const map = useMap();

  useEffect(() => {
    if (sectorsWithCoords.length > 0) {
      const bounds = L.latLngBounds(
        sectorsWithCoords.map((sector) => [parseFloat(sector.latitude), parseFloat(sector.longitude)])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, sectorsWithCoords]);

  return null;
}

const CragMap = ({ crags }) => {
  const navigate = useNavigate();
  const [sectors, setSectors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Moravsky kras region center coordinates
  const defaultCenter = [49.4, 16.7];
  const defaultZoom = 11;

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
    } catch (err) {
      console.error('❌ Failed to fetch sectors:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter sectors that have coordinates
  const sectorsWithCoords = sectors.filter(
    (sector) => sector.latitude && sector.longitude
  );

  const handleMarkerClick = (areaId) => {
    navigate(`/crags/${areaId}`);
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
          <MapBounds sectorsWithCoords={sectorsWithCoords} />
          {sectorsWithCoords.map((sector) => (
            <Marker
              key={sector.id}
              position={[parseFloat(sector.latitude), parseFloat(sector.longitude)]}
              eventHandlers={{
                click: () => handleMarkerClick(sector.area),
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
                    onClick={() => handleMarkerClick(sector.area)}
                    className="map-popup-button"
                  >
                    View Area
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

