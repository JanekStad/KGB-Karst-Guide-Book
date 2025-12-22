import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AlternativeListView from '../components/AlternativeListView';
import CragMap from '../components/CragMap';
import { areasAPI, problemsAPI, sectorsAPI } from '../services/api';
import './Crags.css';

const Crags = () => {
  const navigate = useNavigate();
  const [sectors, setSectors] = useState([]);
  const [problems, setProblems] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('any');
  const [selectedSector, setSelectedSector] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterType, setFilterType] = useState('all'); // 'all', 'sector', or 'problem'
  const [viewMode, setViewMode] = useState('map'); // 'map' or 'list'
  const sidebarRef = useRef(null);
  const isInitialMount = useRef(true);

  useEffect(() => {
    fetchAreas();
    fetchSectors(true); // Pass true to indicate initial load
    fetchProblems();
    // Mark initial mount as complete after a short delay to allow initial load to start
    const timer = setTimeout(() => {
      isInitialMount.current = false;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Debounce search to avoid too many API calls
  useEffect(() => {
    // Skip debounce on initial mount (handled by initial useEffect)
    if (isInitialMount.current) {
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(() => {
      fetchSectors(false); // Pass false to indicate this is a search, not initial load
      fetchProblems();
    }, 800); // 800ms debounce - allows user to finish typing

    return () => {
      clearTimeout(timeoutId);
      setIsSearching(false);
    };
  }, [selectedArea, searchTerm]);

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

  const fetchSectors = async (isInitialLoad = false) => {
    try {
      console.log('📡 Fetching sectors for explore...');
      if (isInitialLoad) {
        setLoading(true);
      }
      const params = {
        ...(selectedArea !== 'any' ? { area: selectedArea } : {}),
        ...(searchTerm ? { search: searchTerm } : {}),
      };
      
      const response = await sectorsAPI.list(params);
      console.log('✅ Sectors fetched successfully:', response.data);
      const fetchedSectors = response.data.results || response.data;
      setSectors(fetchedSectors || []);
      
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch sectors:', err);
      setError('Failed to load sectors. Please try again.');
    } finally {
      setLoading(false);
      setIsSearching(false);
    }
  };

  const fetchProblems = async () => {
    try {
      console.log('📡 Fetching problems for explore...');
      const params = {
        ...(selectedArea !== 'any' ? { area: selectedArea } : {}),
        ...(searchTerm ? { search: searchTerm } : {}),
      };
      
      const response = await problemsAPI.list(params);
      console.log('✅ Problems fetched successfully:', response.data);
      const fetchedProblems = response.data.results || response.data;
      setProblems(fetchedProblems || []);
      
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch problems:', err);
      // Don't set error for problems, just log it
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchSectors();
    fetchProblems();
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

  const handleProblemClick = (problem) => {
    navigate(`/problems/${problem.id}`);
  };

  // Combine sectors and problems for display
  // Backend now handles diacritic-insensitive search, so no client-side filtering needed
  const allItems = useMemo(() => {
    const sectorItems = sectors.map(sector => ({
      ...sector,
      type: 'sector',
      displayName: sector.name,
      location: sector.area_name || 'Unknown Location',
      problemCount: sector.problem_count || 0,
    }));
    
    const problemItems = problems.map(problem => ({
      ...problem,
      type: 'problem',
      displayName: problem.name,
      location: problem.area_name || 'Unknown Location',
      grade: problem.grade,
    }));
    
    // Filter based on selected filter type
    if (filterType === 'sector') {
      return sectorItems;
    } else if (filterType === 'problem') {
      return problemItems;
    } else {
      // 'all' - return both sectors and problems
      return [...sectorItems, ...problemItems];
    }
  }, [sectors, problems, filterType]);

  // Get sectors with coordinates for map
  const sectorsWithCoords = useMemo(() => {
    return sectors.filter(sector => 
      sector.latitude && sector.longitude
    );
  }, [sectors]);


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
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="explore-page">
        <div className="error">
          <h3>Error loading data</h3>
          <p>{error}</p>
          <button onClick={() => { fetchSectors(); fetchProblems(); }} className="btn btn-primary">
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
              <button 
                className={`filter-chip ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                All
              </button>
              <button 
                className={`filter-chip ${filterType === 'sector' ? 'active' : ''}`}
                onClick={() => setFilterType('sector')}
              >
                Sector
              </button>
              <button 
                className={`filter-chip ${filterType === 'problem' ? 'active' : ''}`}
                onClick={() => setFilterType('problem')}
              >
                Problem
              </button>
            </div>

            {/* View Toggle */}
            <div className="view-toggle-group">
              <button
                className={`view-toggle-btn ${viewMode === 'map' ? 'active' : ''}`}
                onClick={() => setViewMode('map')}
                title="Map View"
              >
                <span className="material-symbols-outlined">map</span>
                <span className="hidden-mobile">Map</span>
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                <span className="material-symbols-outlined">view_list</span>
                <span className="hidden-mobile">List</span>
              </button>
            </div>
          </div>

          {/* List View */}
          <div className="sidebar-list">
            <p className="sidebar-list-header">
              Results ({allItems.length})
            </p>
            <div className="crag-list">
              {allItems.length === 0 ? (
                <div className="empty-state">
                  <p>No results found.</p>
                </div>
              ) : (
                allItems.map((item) => {
                  if (item.type === 'sector') {
                    return (
                      <div
                        key={`sector-${item.id}`}
                        className={`crag-list-item ${selectedSector?.id === item.id ? 'active' : ''}`}
                        onClick={() => {
                          handleSectorSelect(item);
                          handleSectorClick(item);
                        }}
                      >
                        <div className="crag-list-image">
                          <div className="crag-list-image-placeholder"></div>
                          <div className="grade-badge-small">
                            {item.problemCount}
                          </div>
                        </div>
                        <div className="crag-list-content">
                          <div className="crag-list-header">
                            <p className="crag-list-name">{item.displayName}</p>
                            <span className="item-type-badge">Sector</span>
                          </div>
                          <p className="crag-list-location">{item.location}</p>
                          {item.problemCount !== undefined && (
                            <div className="crag-list-rating">
                              <span className="rating-count">{item.problemCount} problem{item.problemCount !== 1 ? 's' : ''}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  } else {
                    return (
                      <div
                        key={`problem-${item.id}`}
                        className="crag-list-item"
                        onClick={() => handleProblemClick(item)}
                      >
                        <div className="crag-list-image">
                          <div className="crag-list-image-placeholder"></div>
                          <div className="grade-badge-small">
                            {item.grade}
                          </div>
                        </div>
                        <div className="crag-list-content">
                          <div className="crag-list-header">
                            <p className="crag-list-name">{item.displayName}</p>
                            <span className="item-type-badge">Problem</span>
                          </div>
                          <p className="crag-list-location">{item.location}</p>
                          {item.grade && (
                            <div className="crag-list-rating">
                              <span className="rating-count">Grade: {item.grade}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                })
              )}
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className={`explore-main-area ${viewMode === 'list' ? 'list-view' : 'map-view'}`}>
          {viewMode === 'map' ? (
            <>
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
            </>
          ) : (
            <AlternativeListView
              sectors={sectors}
              problems={problems}
              areas={areas}
              selectedArea={selectedArea}
              searchTerm={searchTerm}
              onAreaChange={setSelectedArea}
              onSwitchToMapView={() => setViewMode('map')}
            />
          )}

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
