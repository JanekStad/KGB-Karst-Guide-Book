import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CragMap from '../components/CragMap';
import { sectorsAPI, areasAPI } from '../services/api';
import { normalizeString } from '../utils/normalize';
import './Crags.css';

const Crags = () => {
  const navigate = useNavigate();
  const [sectors, setSectors] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('any');
  const [selectedSector, setSelectedSector] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebarRef = useRef(null);

  useEffect(() => {
    fetchAreas();
    fetchSectors();
  }, []);

  useEffect(() => {
    fetchSectors();
  }, [selectedArea]);

  const fetchAreas = async () => {
    try {
      console.log('📡 Fetching areas for filter...');
      const response = await areasAPI.list();
      console.log('✅ Areas fetched successfully:', response.data);
      const fetchedAreas = response.data.results || response.data;
      setAreas(fetchedAreas || []);
    } catch (err) {
      console.error('❌ Failed to fetch areas:', err);
    }
  };

  const fetchSectors = async () => {
    try {
      console.log('📡 Fetching sectors for explore...');
      setLoading(true);
      const params = {
        // Note: We don't send search to backend since it may not handle diacritics
        // Client-side normalization handles both case and diacritics
        ...(selectedArea !== 'any' ? { area: selectedArea } : {}),
      };
      const response = await sectorsAPI.list(params);
      console.log('✅ Sectors fetched successfully:', response.data);
      const fetchedSectors = response.data.results || response.data;
      setSectors(fetchedSectors);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch sectors:', err);
      setError('Failed to load sectors. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchSectors();
  };

  const handleSectorSelect = (sector) => {
    setSelectedSector(sector);
    // Close sidebar on mobile when sector is selected
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleSectorClick = (sector) => {
    navigate(`/sectors/${sector.id}`);
  };

  // Filter sectors with client-side normalization for diacritics-insensitive search
  // This complements the server-side search which may not handle diacritics
  const filteredSectors = useMemo(() => {
    if (!searchTerm) {
      return sectors;
    }
    
    const normalizedSearch = normalizeString(searchTerm);
    
    return sectors.filter(sector => {
      const normalizedSectorName = normalizeString(sector.name);
      const normalizedAreaName = normalizeString(sector.area_name || '');
      
      return (
        normalizedSectorName.includes(normalizedSearch) ||
        normalizedAreaName.includes(normalizedSearch)
      );
    });
  }, [sectors, searchTerm]);

  // Get sectors with coordinates for map
  const sectorsWithCoords = useMemo(() => {
    return filteredSectors.filter(sector => 
      sector.latitude && sector.longitude
    );
  }, [filteredSectors]);

  const getSectorLocation = (sector) => {
    if (sector.area_name) {
      return sector.area_name;
    }
    return 'Unknown Location';
  };

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target) && window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };

    if (sidebarOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [sidebarOpen]);

  if (loading) {
    return (
      <div className="explore-page">
        <div className="loading">Loading sectors...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="explore-page">
        <div className="error">
          <h3>Error loading sectors</h3>
          <p>{error}</p>
          <button onClick={fetchSectors} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="explore-page">
      {/* Split View Container */}
      <div className="explore-split-view">
        {/* Sidebar */}
        <aside 
          ref={sidebarRef}
          className={`explore-sidebar ${sidebarOpen ? 'open' : ''}`}
        >
          {/* Sidebar Controls */}
          <div className="sidebar-controls">
            {/* Search */}
            <div className="sidebar-search">
              <span className="material-symbols-outlined search-icon">search</span>
              <input
                type="text"
                className="sidebar-search-input"
                placeholder="Find a crag or problem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(e);
                  }
                }}
              />
            </div>

            {/* Filters Row 1 */}
            <div className="filters-row">
              <div className="filter-select-wrapper">
                <select
                  className="filter-select"
                  value={selectedArea}
                  onChange={(e) => {
                    setSelectedArea(e.target.value);
                  }}
                >
                  <option value="any">Any Area</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined filter-select-icon">expand_more</span>
              </div>
              <button className="filter-more-btn">
                <span className="material-symbols-outlined">filter_list</span>
                <span>More</span>
              </button>
            </div>

            {/* Filter Chips */}
            <div className="filter-chips">
              <button className="filter-chip active">Nearby</button>
              <button className="filter-chip">All</button>
            </div>
          </div>

          {/* List View */}
          <div className="sidebar-list">
            <p className="sidebar-list-header">
              Visible Sectors ({filteredSectors.length})
            </p>
            <div className="crag-list">
              {filteredSectors.length === 0 ? (
                <div className="empty-state">
                  <p>No sectors found.</p>
                </div>
              ) : (
                filteredSectors.map((sector) => {
                  return (
                    <div
                      key={sector.id}
                      className={`crag-list-item ${selectedSector?.id === sector.id ? 'active' : ''}`}
                      onClick={() => {
                        handleSectorSelect(sector);
                        handleSectorClick(sector);
                      }}
                    >
                      <div className="crag-list-image">
                        <div className="crag-list-image-placeholder"></div>
                        <div className="grade-badge-small">
                          {sector.problem_count || 0}
                        </div>
                      </div>
                      <div className="crag-list-content">
                        <div className="crag-list-header">
                          <p className="crag-list-name">{sector.name}</p>
                        </div>
                        <p className="crag-list-location">{getSectorLocation(sector)}</p>
                        {sector.problem_count !== undefined && (
                          <div className="crag-list-rating">
                            <span className="rating-count">{sector.problem_count} problem{sector.problem_count !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* Map Area */}
        <main className="explore-map-area">
          {/* Map */}
          <div className="map-container">
            <CragMap 
              sectors={sectorsWithCoords}
              selectedSector={selectedSector}
              onSectorSelect={handleSectorSelect}
            />
          </div>

          {/* Map Controls */}
          <div className="map-controls">
            <button className="map-control-btn" title="Locate me">
              <span className="material-symbols-outlined">my_location</span>
            </button>
            <div className="map-zoom-controls">
              <button className="map-control-btn" title="Zoom in">
                <span className="material-symbols-outlined">add</span>
              </button>
              <button className="map-control-btn" title="Zoom out">
                <span className="material-symbols-outlined">remove</span>
              </button>
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="mobile-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        </main>
      </div>
    </div>
  );
};

export default Crags;
