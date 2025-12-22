import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StarRating from './StarRating';
import './AlternativeListView.css';

const AlternativeListView = ({ 
  sectors, 
  problems, 
  areas, 
  selectedArea, 
  searchTerm,
  onAreaChange,
  onSwitchToMapView
}) => {
  const navigate = useNavigate();
  const [minGrade, setMinGrade] = useState('3');
  const [maxGrade, setMaxGrade] = useState('9A+');
  const [sortBy, setSortBy] = useState('popularity');
  const [activeFilters, setActiveFilters] = useState({
    sent: false,
    highRating: false,
    classic: false,
    highball: false,
  });

  const GRADE_CHOICES = [
    '3', '3+', '4', '4+', '5', '5+',
    '6A', '6A+', '6B', '6B+', '6C', '6C+',
    '7A', '7A+', '7B', '7B+', '7C', '7C+',
    '8A', '8A+', '8B', '8B+', '8C', '8C+',
    '9A', '9A+',
  ];

  // Get selected area details
  const selectedAreaData = useMemo(() => {
    if (selectedArea === 'any') return null;
    return areas.find(a => a.id === selectedArea) || null;
  }, [selectedArea, areas]);

  // Group problems by sector
  const problemsBySector = useMemo(() => {
    const grouped = {};
    
    problems.forEach(problem => {
      const sectorId = problem.sector?.id || problem.sector || 'no-sector';
      const sectorName = problem.sector_name || problem.sector?.name || 'Unnamed Sector';
      
      if (!grouped[sectorId]) {
        grouped[sectorId] = {
          id: sectorId,
          name: sectorName,
          area: problem.area_name || problem.area?.name,
          description: problem.sector?.description,
          problems: []
        };
      }
      
      grouped[sectorId].problems.push(problem);
    });

    // Also add sectors that don't have problems yet
    sectors.forEach(sector => {
      if (!grouped[sector.id]) {
        grouped[sector.id] = {
          id: sector.id,
          name: sector.name,
          area: sector.area_name,
          description: sector.description,
          problems: []
        };
      }
    });

    // Sort sectors by name
    return Object.values(grouped).sort((a, b) => 
      (a.name || '').localeCompare(b.name || '')
    );
  }, [problems, sectors]);

  // Filter and sort problems
  const filteredProblemsBySector = useMemo(() => {
    return problemsBySector.map(sector => {
      let filtered = [...sector.problems];

      // Filter by grade range
      filtered = filtered.filter(problem => {
        if (!problem.grade) return true; // Include problems without grades
        const gradeIndex = GRADE_CHOICES.indexOf(problem.grade);
        const minIndex = GRADE_CHOICES.indexOf(minGrade);
        const maxIndex = GRADE_CHOICES.indexOf(maxGrade);
        // If grade not found in choices, include it
        if (gradeIndex === -1) return true;
        return gradeIndex >= minIndex && gradeIndex <= maxIndex;
      });

      // Filter by active filters
      if (activeFilters.sent) {
        // This would need tick data - for now, skip
      }
      if (activeFilters.highRating) {
        filtered = filtered.filter(p => (p.average_rating || p.rating) >= 4);
      }

      // Sort problems
      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'popularity':
            return (b.tick_count || 0) - (a.tick_count || 0);
          case 'difficulty-asc':
            const aGrade = GRADE_CHOICES.indexOf(a.grade || '3');
            const bGrade = GRADE_CHOICES.indexOf(b.grade || '3');
            // Put problems without grades at the end
            if (aGrade === -1 && bGrade === -1) return 0;
            if (aGrade === -1) return 1;
            if (bGrade === -1) return -1;
            return aGrade - bGrade;
          case 'difficulty-desc':
            const aGradeDesc = GRADE_CHOICES.indexOf(a.grade || '3');
            const bGradeDesc = GRADE_CHOICES.indexOf(b.grade || '3');
            // Put problems without grades at the end
            if (aGradeDesc === -1 && bGradeDesc === -1) return 0;
            if (aGradeDesc === -1) return 1;
            if (bGradeDesc === -1) return -1;
            return bGradeDesc - aGradeDesc;
          case 'alphabetical':
            return (a.name || '').localeCompare(b.name || '');
          default:
            return 0;
        }
      });

      return { ...sector, problems: filtered };
    }).filter(sector => sector.problems.length > 0 || sector.id !== 'no-sector');
  }, [problemsBySector, minGrade, maxGrade, activeFilters, sortBy]);

  const handleProblemClick = (problem) => {
    navigate(`/problems/${problem.id}`);
  };

  const handleSectorClick = (sector) => {
    if (sector.id !== 'no-sector') {
      navigate(`/sectors/${sector.id}`);
    }
  };

  const toggleFilter = (filterName) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterName]: !prev[filterName]
    }));
  };

  // Get first image from problem
  const getProblemImage = (problem) => {
    if (problem.primary_image) return problem.primary_image;
    if (problem.images && problem.images.length > 0) {
      return problem.images[0].image;
    }
    return null;
  };

  // Check if problem is ticked (would need tick data)
  const isTicked = (problem) => {
    // This would need to be passed as prop or fetched
    return false;
  };

  return (
    <div className="alternative-list-view">
      {/* Hero Section */}
      {selectedAreaData ? (
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

      {/* Filter Bar */}
      <div className="list-filter-bar">
        <div className="filter-bar-content">
          <div className="filter-group">
            <span className="filter-label">Grade</span>
            <div className="grade-range">
              <select 
                value={minGrade} 
                onChange={(e) => setMinGrade(e.target.value)}
                className="grade-select"
              >
                {GRADE_CHOICES.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
              <span className="grade-separator">-</span>
              <select 
                value={maxGrade} 
                onChange={(e) => setMaxGrade(e.target.value)}
                className="grade-select"
              >
                {GRADE_CHOICES.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="filter-chips-group">
            <button
              className={`filter-chip ${activeFilters.sent ? 'active' : ''}`}
              onClick={() => toggleFilter('sent')}
            >
              <span className="material-symbols-outlined">check</span>
              Sent
            </button>
            <button
              className={`filter-chip ${activeFilters.highRating ? 'active' : ''}`}
              onClick={() => toggleFilter('highRating')}
            >
              <span className="material-symbols-outlined">star</span>
              4 Stars+
            </button>
            <button
              className={`filter-chip ${activeFilters.classic ? 'active' : ''}`}
              onClick={() => toggleFilter('classic')}
            >
              Classic
            </button>
            <button
              className={`filter-chip ${activeFilters.highball ? 'active' : ''}`}
              onClick={() => toggleFilter('highball')}
            >
              Highball
            </button>
          </div>

          <div className="filter-spacer"></div>

          <div className="filter-group sort-group">
            <span className="filter-label">Sort</span>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="popularity">Popularity</option>
              <option value="difficulty-asc">Difficulty (Low to High)</option>
              <option value="difficulty-desc">Difficulty (High to Low)</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="list-content-area">
        {filteredProblemsBySector.length === 0 ? (
          <div className="empty-state">
            <p>No problems found matching your filters.</p>
          </div>
        ) : (
          filteredProblemsBySector.map((sector) => (
            <section key={sector.id} className="sector-section">
              <div className="sector-section-header">
                <div>
                  <h2 className="sector-title">
                    {sector.name}
                    <span className="problem-count-badge">
                      {sector.problems.length} Problem{sector.problems.length !== 1 ? 's' : ''}
                    </span>
                  </h2>
                  {sector.description && (
                    <p className="sector-description">{sector.description}</p>
                  )}
                </div>
                <button 
                  className="sector-view-details"
                  onClick={() => handleSectorClick(sector)}
                >
                  View Sector Details
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>
              </div>

              <div className="problems-grid">
                {sector.problems.map((problem) => {
                  const imageUrl = getProblemImage(problem);
                  const ticked = isTicked(problem);
                  
                  return (
                    <div
                      key={problem.id}
                      className="problem-card"
                      onClick={() => handleProblemClick(problem)}
                    >
                      {imageUrl ? (
                        <div 
                          className="problem-card-image"
                          style={{ backgroundImage: `url(${imageUrl})` }}
                        >
                          <div className="problem-grade-overlay">
                            {problem.grade || '?'}
                          </div>
                        </div>
                      ) : (
                        <div className="problem-card-image problem-card-image-placeholder">
                          <span className="material-symbols-outlined">image</span>
                          <div className="problem-grade-overlay">
                            {problem.grade || '?'}
                          </div>
                        </div>
                      )}
                      
                      <div className="problem-card-content">
                        <div className="problem-card-header">
                          <h3 className="problem-card-name">{problem.name}</h3>
                          {ticked && (
                            <span className="material-symbols-outlined ticked-icon">check_circle</span>
                          )}
                          {!ticked && problem.is_project && (
                            <span className="project-badge">PROJECT</span>
                          )}
                        </div>
                        
                        {(problem.average_rating || problem.rating) && (
                          <div className="problem-card-rating">
                            <StarRating 
                              rating={parseFloat(problem.average_rating || problem.rating)} 
                              size="small" 
                            />
                            <span className="rating-count">
                              ({problem.tick_count || 0})
                            </span>
                          </div>
                        )}

                        {problem.tags && problem.tags.length > 0 && (
                          <div className="problem-card-tags">
                            {problem.tags.slice(0, 3).map((tag, idx) => (
                              <span key={idx} className="problem-tag">{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
};

export default AlternativeListView;

