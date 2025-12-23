import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StarRating from './StarRating';
import './AlternativeListView.css';

const AlternativeListView = ({ 
  sectors, 
  problems, 
  areas, 
  selectedArea,
  selectedSector,
  searchTerm,
  onAreaChange,
  onSectorSelect,
  onSwitchToMapView
}) => {
  const navigate = useNavigate();
  const [sortField, setSortField] = useState('grade');
  const [sortOrder, setSortOrder] = useState('desc');

  // Get selected area details
  const selectedAreaData = useMemo(() => {
    if (selectedArea === 'any') return null;
    return areas.find(a => a.id === selectedArea) || null;
  }, [selectedArea, areas]);

  // Group sectors by area
  const sectorsByArea = useMemo(() => {
    const grouped = {};
    
    // Group sectors by their area
    sectors.forEach(sector => {
      const areaId = sector.area?.id || sector.area || 'no-area';
      const areaName = sector.area_name || sector.area?.name || 'Unknown Area';
      
      if (!grouped[areaId]) {
        // Find the area data from areas array
        const areaData = areas.find(a => a.id === areaId);
        grouped[areaId] = {
          id: areaId,
          name: areaName,
          city_name: areaData?.city_name || null,
          sectors: []
        };
      }
      
      grouped[areaId].sectors.push({
        id: sector.id,
        name: sector.name,
        description: sector.description,
        problem_count: sector.problem_count || 0,
        latitude: sector.latitude,
        longitude: sector.longitude,
      });
    });

    // Sort sectors within each area by problem count (descending)
    Object.values(grouped).forEach(area => {
      area.sectors.sort((a, b) => (b.problem_count || 0) - (a.problem_count || 0));
    });

    // Sort areas by total problem count (descending)
    return Object.values(grouped).sort((a, b) => {
      const aTotal = a.sectors.reduce((sum, s) => sum + (s.problem_count || 0), 0);
      const bTotal = b.sectors.reduce((sum, s) => sum + (s.problem_count || 0), 0);
      return bTotal - aTotal;
    });
  }, [sectors, areas]);

  const handleSectorClick = (sector) => {
    if (onSectorSelect) {
      // Find the full sector object from sectors array
      const fullSector = sectors.find(s => s.id === sector.id);
      if (fullSector) {
        onSectorSelect(fullSector);
      }
    }
  };

  const handleProblemClick = (problem) => {
    navigate(`/problems/${problem.id}`);
  };

  // Filter problems by selected sector
  const sectorProblems = useMemo(() => {
    if (!selectedSector) return [];
    return problems.filter(problem => {
      const problemSectorId = problem.sector?.id || problem.sector;
      return problemSectorId === selectedSector.id;
    });
  }, [problems, selectedSector]);

  // Sort problems
  const sortedProblems = useMemo(() => {
    const sorted = [...sectorProblems];
    sorted.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case 'grade':
          const GRADE_ORDER = ['3', '3+', '4', '4+', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+', '7A', '7A+', '7B', '7B+', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A', '9A+'];
          aVal = GRADE_ORDER.indexOf(a.grade || '3');
          bVal = GRADE_ORDER.indexOf(b.grade || '3');
          if (aVal === -1) aVal = 999;
          if (bVal === -1) bVal = 999;
          break;
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'rating':
          aVal = parseFloat(a.average_rating || a.rating || 0);
          bVal = parseFloat(b.average_rating || b.rating || 0);
          break;
        case 'repeats':
          aVal = a.tick_count || 0;
          bVal = b.tick_count || 0;
          break;
        default:
          return 0;
      }
      
      if (sortField === 'name') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [sectorProblems, sortField, sortOrder]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'name' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="alternative-list-view">
      {/* Hero Section */}
      {selectedSector ? (
        <div 
          className="list-hero-section"
          style={{
            backgroundImage: 'linear-gradient(135deg, var(--background-dark) 0%, var(--surface-dark) 100%)'
          }}
        >
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <div className="hero-text">
              {selectedSector.area_name && (
                <div className="hero-breadcrumb">
                  <span>{selectedSector.area_name}</span>
                  <span className="material-symbols-outlined">chevron_right</span>
                  <span>{selectedSector.name}</span>
                </div>
              )}
              <h1>{selectedSector.name}</h1>
              {selectedSector.description && (
                <p className="hero-description">{selectedSector.description}</p>
              )}
            </div>
            <div className="hero-actions">
              <button 
                className="hero-btn-secondary"
                onClick={() => onSectorSelect && onSectorSelect(null)}
              >
                <span className="material-symbols-outlined">arrow_back</span>
                <span className="hidden-mobile">Back</span>
              </button>
              <button className="hero-btn-secondary">
                <span className="material-symbols-outlined">share</span>
                <span className="hidden-mobile">Share</span>
              </button>
              {onSwitchToMapView && (
                <button 
                  className="hero-btn-primary"
                  onClick={onSwitchToMapView}
                >
                  <span className="material-symbols-outlined">map</span>
                  Map View
                </button>
              )}
            </div>
          </div>
        </div>
      ) : selectedAreaData ? (
        <div 
          className="list-hero-section"
          style={{
            backgroundImage: selectedAreaData.image 
              ? `url(${selectedAreaData.image})` 
              : 'linear-gradient(135deg, var(--background-dark) 0%, var(--surface-dark) 100%)'
          }}
        >
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <div className="hero-text">
              {selectedAreaData.region && (
                <div className="hero-breadcrumb">
                  <span>{selectedAreaData.region}</span>
                  <span className="material-symbols-outlined">chevron_right</span>
                  <span>{selectedAreaData.name}</span>
                </div>
              )}
              <h1>{selectedAreaData.name}</h1>
              {selectedAreaData.description && (
                <p className="hero-description">{selectedAreaData.description}</p>
              )}
            </div>
            <div className="hero-actions">
              <button className="hero-btn-secondary">
                <span className="material-symbols-outlined">share</span>
                <span className="hidden-mobile">Share</span>
              </button>
              {onSwitchToMapView && (
                <button 
                  className="hero-btn-primary"
                  onClick={onSwitchToMapView}
                >
                  <span className="material-symbols-outlined">map</span>
                  Map View
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="list-hero-section">
          <div className="hero-overlay"></div>
          <div className="hero-content">
            <div className="hero-text">
              <h1>Explore All Areas</h1>
              <p className="hero-description">Browse boulder problems across all areas and sectors.</p>
            </div>
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="list-content-area">
        {selectedSector ? (
          /* Table view when sector is selected */
          <div className="problems-table-section">
            <div className="problems-table-header">
              <h2>{selectedSector.name}</h2>
              <p className="problems-count">
                {sortedProblems.length} Problem{sortedProblems.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="problems-table-wrapper">
              <table className="problems-table">
                <thead>
                  <tr>
                    <th>TICK</th>
                    <th 
                      className={`sortable ${sortField === 'name' ? `sort-${sortOrder}` : ''}`}
                      onClick={() => handleSort('name')}
                    >
                      PROBLEM
                    </th>
                    <th 
                      className={`sortable ${sortField === 'grade' ? `sort-${sortOrder}` : ''}`}
                      onClick={() => handleSort('grade')}
                    >
                      GRADE
                    </th>
                    <th 
                      className={`sortable ${sortField === 'rating' ? `sort-${sortOrder}` : ''}`}
                      onClick={() => handleSort('rating')}
                    >
                      RATING
                    </th>
                    <th 
                      className={`sortable ${sortField === 'repeats' ? `sort-${sortOrder}` : ''}`}
                      onClick={() => handleSort('repeats')}
                    >
                      REPEATS
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProblems.length > 0 ? (
                    sortedProblems.map((problem) => (
                      <tr 
                        key={problem.id} 
                        className="problem-row"
                        onClick={() => handleProblemClick(problem)}
                      >
                        <td className="problem-tick-cell">
                          <span className="tick-icon">○</span>
                        </td>
                        <td className="problem-name-cell">
                          <div className="problem-name-main">{problem.name}</div>
                          {problem.description && (
                            <div className="problem-description">
                              {problem.description.length > 60 
                                ? `${problem.description.substring(0, 60)}...` 
                                : problem.description}
                            </div>
                          )}
                        </td>
                        <td className="problem-grade-cell">
                          <div className="problem-grade-badge">
                            {problem.grade || '?'}
                          </div>
                        </td>
                        <td className="problem-rating-cell">
                          {(problem.average_rating || problem.rating) ? (
                            <StarRating 
                              rating={parseFloat(problem.average_rating || problem.rating)} 
                              size="small" 
                            />
                          ) : (
                            <span className="no-rating">-</span>
                          )}
                        </td>
                        <td className="problem-repeats-cell">
                          {problem.tick_count ? (
                            problem.tick_count >= 1000 
                              ? `${(problem.tick_count / 1000).toFixed(1)}k`
                              : problem.tick_count.toLocaleString()
                          ) : '0'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="no-problems">No problems found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Area/Sector view when no sector is selected */
          sectorsByArea.length === 0 ? (
            <div className="empty-state">
              <p>No areas found.</p>
            </div>
          ) : (
            sectorsByArea.map((area) => (
              <section key={area.id} className="area-section">
                <div className="area-section-header">
                  <div>
                    <h2 className="area-title">
                      {area.name}
                      {area.city_name && (
                        <span className="area-location"> • {area.city_name}</span>
                      )}
                    </h2>
                    <p className="area-sectors-count">
                      {area.sectors.length} Sector{area.sectors.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Horizontally scrollable sector cards */}
                <div className="sectors-scroll-container">
                  <div className="sectors-scroll">
                    {area.sectors.map((sector) => (
                      <div
                        key={sector.id}
                        className="sector-card"
                        onClick={() => handleSectorClick(sector)}
                      >
                        <div className="sector-card-header">
                          <h3 className="sector-card-name">{sector.name}</h3>
                          <span className="sector-card-badge">
                            {sector.problem_count || 0}
                          </span>
                        </div>
                        {sector.description && (
                          <p className="sector-card-description">
                            {sector.description.length > 100 
                              ? `${sector.description.substring(0, 100)}...` 
                              : sector.description}
                          </p>
                        )}
                        <div className="sector-card-footer">
                          <span className="sector-card-problems">
                            {sector.problem_count || 0} problem{(sector.problem_count || 0) !== 1 ? 's' : ''}
                          </span>
                          {sector.latitude && sector.longitude && (
                            <span className="sector-card-coords">
                              <span className="material-symbols-outlined">location_on</span>
                              {parseFloat(sector.latitude).toFixed(4)}, {parseFloat(sector.longitude).toFixed(4)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ))
          )
        )}
      </div>
    </div>
  );
};

export default AlternativeListView;
