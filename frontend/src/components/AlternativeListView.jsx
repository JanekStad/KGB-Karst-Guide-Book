import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './AlternativeListView.css';
import StarRating from './StarRating';
import { useAuth } from '../contexts/AuthContext';
import { ticksAPI } from '../services/api';

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
  const { isAuthenticated, user } = useAuth();
  const [sortField, setSortField] = useState('grade');
  const [sortOrder, setSortOrder] = useState('desc');
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('all'); // 'all', 'ticked', 'unticked'
  const [currentPage, setCurrentPage] = useState(1);
  const [showGradeDropdown, setShowGradeDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [gradeSearchTerm, setGradeSearchTerm] = useState('');
  const gradeFilterRef = useRef(null);
  const statusFilterRef = useRef(null);
  const sortFilterRef = useRef(null);
  const PAGE_SIZE = 50; // Number of problems per page

  const GRADE_CHOICES = [
    '3', '3+', '4', '4+', '5', '5+',
    '6A', '6A+', '6B', '6B+', '6C', '6C+',
    '7A', '7A+', '7B', '7B+', '7C', '7C+',
    '8A', '8A+', '8B', '8B+', '8C', '8C+',
    '9A', '9A+',
  ];

  const SORT_OPTIONS = [
    { value: 'grade', label: 'Grade (Hardest)', order: 'desc' },
    { value: 'grade', label: 'Grade (Easiest)', order: 'asc' },
    { value: 'name', label: 'Name (A-Z)', order: 'asc' },
    { value: 'name', label: 'Name (Z-A)', order: 'desc' },
    { value: 'ascents', label: 'Ascents (Most)', order: 'desc' },
    { value: 'ascents', label: 'Ascents (Least)', order: 'asc' },
    { value: 'stars', label: 'Rating (Highest)', order: 'desc' },
    { value: 'stars', label: 'Rating (Lowest)', order: 'asc' },
  ];

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

  const [ticks, setTicks] = useState({}); // Map of problemId -> tick object

  // Fetch user ticks when sector is selected and user is authenticated
  useEffect(() => {
    if (selectedSector && isAuthenticated) {
      fetchUserTicks();
    } else {
      setTicks({});
    }
  }, [selectedSector?.id, isAuthenticated]);

  const fetchUserTicks = async () => {
    if (!isAuthenticated) return;
    try {
      const response = await ticksAPI.list();
      const ticksList = response.data.results || response.data;
      // Create a map of problemId -> tick
      const ticksMap = {};
      ticksList.forEach(tick => {
        const problemId = tick.problem?.id || tick.problem;
        if (problemId) {
          ticksMap[problemId] = tick;
        }
      });
      setTicks(ticksMap);
    } catch (err) {
      console.error('Failed to fetch ticks:', err);
    }
  };

  const handleProblemClick = (problem) => {
    navigate(`/problems/${problem.id}`);
  };

  // Get all problems for the sector (unfiltered) for grade counts
  const allSectorProblems = useMemo(() => {
    if (!selectedSector) return [];
    return problems.filter(problem => {
      const problemSectorId = problem.sector?.id || problem.sector;
      return problemSectorId === selectedSector.id;
    });
  }, [problems, selectedSector]);

  // Get available grades from problems
  const availableGrades = useMemo(() => {
    const grades = new Set(allSectorProblems.map(p => p.grade).filter(Boolean));
    return GRADE_CHOICES.filter(grade => grades.has(grade));
  }, [allSectorProblems]);

  // Get grade counts from all sector problems
  const gradeCounts = useMemo(() => {
    const counts = {};
    allSectorProblems.forEach(problem => {
      if (problem.grade) {
        counts[problem.grade] = (counts[problem.grade] || 0) + 1;
      }
    });
    return counts;
  }, [allSectorProblems]);

  // Filter problems by selected sector, search term, grade, and status
  const sectorProblems = useMemo(() => {
    if (!selectedSector) return [];
    let filtered = problems.filter(problem => {
      const problemSectorId = problem.sector?.id || problem.sector;
      return problemSectorId === selectedSector.id;
    });
    
    // Apply search filter
    if (tableSearchTerm) {
      const searchLower = tableSearchTerm.toLowerCase();
      filtered = filtered.filter(problem => {
        const name = (problem.name || '').toLowerCase();
        const description = (problem.description || '').toLowerCase();
        const author = (problem.author_username || '').toLowerCase();
        return name.includes(searchLower) || 
               description.includes(searchLower) || 
               author.includes(searchLower);
      });
    }
    
    // Apply grade filter
    if (selectedGrade) {
      filtered = filtered.filter(problem => problem.grade === selectedGrade);
    }
    
    // Apply status filter (ticked/unticked)
    if (selectedStatus === 'ticked') {
      filtered = filtered.filter(problem => {
        const problemId = problem.id;
        return ticks[problemId] !== undefined;
      });
    } else if (selectedStatus === 'unticked') {
      filtered = filtered.filter(problem => {
        const problemId = problem.id;
        return ticks[problemId] === undefined;
      });
    }
    
    return filtered;
  }, [problems, selectedSector, tableSearchTerm, selectedGrade, selectedStatus, ticks]);

  // Grade classification utility (same as SectorDetail)
  const gradeClass = (grade) => {
    if (!grade) return 'grade-badge-unknown';
    const clean = grade.replace('+', '');
    if (/^[345]$/.test(clean)) return 'grade-badge-easy';
    if (/^6[A-C]?$/.test(clean)) return 'grade-badge-medium';
    if (/^7[A-C]?$/.test(clean)) return 'grade-badge-hard';
    if (/^[89]/.test(clean) || /^9/.test(clean)) return 'grade-badge-pro';
    return 'grade-badge-default';
  };

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
        case 'stars':
        case 'rating':
          aVal = parseFloat(a.average_rating || a.rating || 0);
          bVal = parseFloat(b.average_rating || b.rating || 0);
          break;
        case 'ascents':
        case 'repeats':
          aVal = a.tick_count || 0;
          bVal = b.tick_count || 0;
          break;
        case 'author':
          aVal = (a.author_username || '').toLowerCase();
          bVal = (b.author_username || '').toLowerCase();
          break;
        default:
          return 0;
      }
      
      if (sortField === 'name' || sortField === 'author') {
        return sortOrder === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [sectorProblems, sortField, sortOrder]);

  // Paginate sorted problems
  const totalPages = Math.ceil(sortedProblems.length / PAGE_SIZE);
  const paginatedProblems = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const endIndex = startIndex + PAGE_SIZE;
    return sortedProblems.slice(startIndex, endIndex);
  }, [sortedProblems, currentPage]);

  // Reset to page 1 when search term changes
  const handleSearchChange = (value) => {
    setTableSearchTerm(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
    // Scroll to top of table
    const tableSection = document.querySelector('.problems-table-section');
    if (tableSection) {
      tableSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSort = (field, order) => {
    setSortField(field);
    setSortOrder(order);
    setShowSortDropdown(false);
  };

  // Filter available grades by search term
  const filteredAvailableGrades = useMemo(() => {
    if (!gradeSearchTerm) return availableGrades;
    const searchLower = gradeSearchTerm.toLowerCase();
    return availableGrades.filter(grade => grade.toLowerCase().includes(searchLower));
  }, [availableGrades, gradeSearchTerm]);

  // Get current sort option label
  const currentSortLabel = useMemo(() => {
    const option = SORT_OPTIONS.find(opt => 
      opt.value === sortField && opt.order === sortOrder
    );
    return option ? option.label : 'Grade (Hardest)';
  }, [sortField, sortOrder]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (gradeFilterRef.current && !gradeFilterRef.current.contains(event.target)) {
        setShowGradeDropdown(false);
      }
      if (statusFilterRef.current && !statusFilterRef.current.contains(event.target)) {
        setShowStatusDropdown(false);
      }
      if (sortFilterRef.current && !sortFilterRef.current.contains(event.target)) {
        setShowSortDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Reset search and pagination when sector changes
  useEffect(() => {
    setTableSearchTerm('');
    setSelectedGrade(null);
    setSelectedStatus('all');
    setCurrentPage(1);
    setGradeSearchTerm('');
  }, [selectedSector?.id]);

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
                {allSectorProblems.length} Problem{allSectorProblems.length !== 1 ? 's' : ''}
                {sortedProblems.length !== allSectorProblems.length && (
                  <span className="filtered-count"> ({sortedProblems.length} filtered)</span>
                )}
              </p>
          </div>

            {/* Filters Bar */}
            <div className="filters-bar">
              {/* Search Input */}
              <div className="search-wrapper">
                <span className="material-symbols-outlined search-icon">search</span>
                <input
                  type="text"
                  placeholder="Filter by name..."
                  value={tableSearchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="search-input"
                  aria-label="Search problems"
                />
                {tableSearchTerm && (
                  <button 
                    onClick={() => handleSearchChange('')}
                    className="search-clear"
                    aria-label="Clear search"
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Grade Filter */}
              <div className="filter-dropdown-wrapper" ref={gradeFilterRef}>
                <button
                  onClick={() => {
                    setShowGradeDropdown(!showGradeDropdown);
                    setShowStatusDropdown(false);
                    setShowSortDropdown(false);
                  }}
                  className={`filter-dropdown-toggle ${selectedGrade ? 'active' : ''} ${showGradeDropdown ? 'open' : ''}`}
                  aria-expanded={showGradeDropdown}
                >
                  <span>{selectedGrade ? selectedGrade : 'Any Grade'}</span>
                  <span className="filter-icon">▾</span>
                </button>
                {showGradeDropdown && (
                  <div className="filter-dropdown">
                    <div className="filter-dropdown-search">
                      <input
                        type="text"
                        placeholder="Search grades..."
                        value={gradeSearchTerm}
                        onChange={(e) => setGradeSearchTerm(e.target.value)}
                        className="filter-search-input"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="filter-dropdown-list">
                      <button
                        onClick={() => {
                          setSelectedGrade(null);
                          setShowGradeDropdown(false);
                          setGradeSearchTerm('');
                        }}
                        className={`filter-option ${selectedGrade === null ? 'active' : ''}`}
                      >
                        Any Grade ({allSectorProblems.length})
                      </button>
                      {filteredAvailableGrades.length > 0 ? (
                        filteredAvailableGrades.map((grade) => (
                          <button
                            key={grade}
                            onClick={() => {
                              setSelectedGrade(selectedGrade === grade ? null : grade);
                              setShowGradeDropdown(false);
                              setGradeSearchTerm('');
                            }}
                            className={`filter-option ${selectedGrade === grade ? 'active' : ''}`}
                          >
                            {grade} ({gradeCounts[grade] || 0})
                          </button>
                        ))
                      ) : (
                        <div className="filter-option no-results">No grades found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Status Filter */}
              {isAuthenticated && (
                <div className="filter-dropdown-wrapper" ref={statusFilterRef}>
                  <button
                    onClick={() => {
                      setShowStatusDropdown(!showStatusDropdown);
                      setShowGradeDropdown(false);
                      setShowSortDropdown(false);
                    }}
                    className={`filter-dropdown-toggle ${selectedStatus !== 'all' ? 'active' : ''} ${showStatusDropdown ? 'open' : ''}`}
                    aria-expanded={showStatusDropdown}
                  >
                    <span>
                      {selectedStatus === 'ticked' ? 'Ticked' : 
                       selectedStatus === 'unticked' ? 'Unticked' : 
                       'Status'}
                    </span>
                    <span className="filter-icon">▾</span>
                  </button>
                  {showStatusDropdown && (
                    <div className="filter-dropdown">
                      <div className="filter-dropdown-list">
                        <button
                          onClick={() => {
                            setSelectedStatus('all');
                            setShowStatusDropdown(false);
                          }}
                          className={`filter-option ${selectedStatus === 'all' ? 'active' : ''}`}
                        >
                          All
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStatus('ticked');
                            setShowStatusDropdown(false);
                          }}
                          className={`filter-option ${selectedStatus === 'ticked' ? 'active' : ''}`}
                        >
                          Ticked
                        </button>
                        <button
                          onClick={() => {
                            setSelectedStatus('unticked');
                            setShowStatusDropdown(false);
                          }}
                          className={`filter-option ${selectedStatus === 'unticked' ? 'active' : ''}`}
                        >
                          Unticked
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sort By */}
              <div className="sort-wrapper">
                <span className="sort-label">SORT BY:</span>
                <div className="filter-dropdown-wrapper" ref={sortFilterRef}>
                  <button
                    onClick={() => {
                      setShowSortDropdown(!showSortDropdown);
                      setShowGradeDropdown(false);
                      setShowStatusDropdown(false);
                    }}
                    className={`filter-dropdown-toggle ${showSortDropdown ? 'open' : ''}`}
                    aria-expanded={showSortDropdown}
                  >
                    <span>{currentSortLabel}</span>
                    <span className="filter-icon">▾</span>
                  </button>
                  {showSortDropdown && (
                    <div className="filter-dropdown">
                      <div className="filter-dropdown-list">
                        {SORT_OPTIONS.map((option, index) => (
                          <button
                            key={`${option.value}-${option.order}-${index}`}
                            onClick={() => handleSort(option.value, option.order)}
                            className={`filter-option ${sortField === option.value && sortOrder === option.order ? 'active' : ''}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="problems-table-wrapper">
              <table className="problems-table">
                <thead>
                  <tr>
                    <th 
                      className={`sortable ${sortField === 'grade' ? `sort-${sortOrder}` : ''}`}
                      onClick={() => handleSort('grade')}
                    >
                      GRADE
                    </th>
                    <th 
                      className={`sortable ${sortField === 'name' ? `sort-${sortOrder}` : ''}`}
                      onClick={() => handleSort('name')}
                    >
                      NAME
                    </th>
                    <th>MEDIA</th>
                    <th 
                      className={`sortable ${sortField === 'ascents' ? `sort-${sortOrder}` : ''}`}
                      onClick={() => handleSort('ascents')}
                    >
                      ASCENTS
                    </th>
                    <th 
                      className={`sortable ${sortField === 'author' ? `sort-${sortOrder}` : ''}`}
                      onClick={() => handleSort('author')}
                    >
                      AUTHOR
                    </th>
                    <th 
                      className={`sortable ${sortField === 'stars' ? `sort-${sortOrder}` : ''}`}
                      onClick={() => handleSort('stars')}
                    >
                      STARS
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProblems.length > 0 ? (
                    paginatedProblems.map((problem) => (
                      <tr 
                        key={problem.id} 
                        className="problem-row"
                      >
                        <td className="problem-grade-cell">
                          <div 
                            className={`problem-grade-badge ${gradeClass(problem.grade)}`}
                          >
                            {problem.grade || '?'}
                          </div>
                        </td>
                        <td className="problem-name-cell">
                          <div 
                            className="problem-name-link"
                            onClick={() => handleProblemClick(problem)}
                          >
                            <div className="problem-name-main">{problem.name}</div>
                            <div className="problem-location">
                              {problem.sector_name || selectedSector?.name || ''}
                              {problem.wall_name && `, ${problem.wall_name}`}
                        </div>
                          </div>
                        </td>
                        <td className="problem-media-cell">
                          {problem.media_count > 0 ? problem.media_count : '-'}
                        </td>
                        <td className="problem-ascents-cell">
                          {problem.tick_count || 0}
                        </td>
                        <td className="problem-author-cell">
                          {problem.author_username || '-'}
                        </td>
                        <td className="problem-stars-cell">
                          {(problem.average_rating || problem.rating) ? (
                            <StarRating 
                              rating={parseFloat(problem.average_rating || problem.rating)} 
                              size="small" 
                            />
                          ) : '-'}
                        </td>
                        <td className="problem-actions-cell">
                          <div className="problem-actions">
                            <button 
                              className="tick-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                // TODO: Handle tick action
                              }}
                              title="Add to tick list"
                            >
                              +
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="no-problems">
                        {tableSearchTerm ? 'No problems found matching your search.' : 'No problems found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {sortedProblems.length > 0 && (
              <div className="pagination">
                <div className="pagination-info">
                  Showing {((currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(currentPage * PAGE_SIZE, sortedProblems.length)} of {sortedProblems.length} problem{sortedProblems.length !== 1 ? 's' : ''}
                </div>
                {totalPages > 1 && (
                  <div className="pagination-controls">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="pagination-btn"
                    >
                      ← Previous
                    </button>
                    <span className="pagination-page">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="pagination-btn"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}
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

