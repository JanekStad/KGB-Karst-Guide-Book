import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StarRating from '../components/StarRating';
import { useAuth } from '../contexts/AuthContext';
import { sectorsAPI, ticksAPI } from '../services/api';
import './SectorDetail.css';

const SectorDetail = () => {
  const { id } = useParams();
  const { isAuthenticated, user } = useAuth();
  const [sector, setSector] = useState(null);
  const [problems, setProblems] = useState([]);
  const [allProblems, setAllProblems] = useState([]);
  const [availableGrades, setAvailableGrades] = useState([]);
  const [gradeCounts, setGradeCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [sortField, setSortField] = useState('grade');
  const [sortOrder, setSortOrder] = useState('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [showGradeDropdown, setShowGradeDropdown] = useState(false);
  const [gradeSearchTerm, setGradeSearchTerm] = useState('');
  const [ticks, setTicks] = useState({}); // Map of problemId -> tick object
  const [showTickModal, setShowTickModal] = useState(false);
  const [selectedProblemForTick, setSelectedProblemForTick] = useState(null);
  const [tickFormData, setTickFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    notes: '',
    tick_grade: '',
    suggested_grade: '',
    rating: null,
  });
  const gradeFilterRef = useRef(null);

  const GRADE_CHOICES = [
    '3', '3+', '4', '4+', '5', '5+',
    '6A', '6A+', '6B', '6B+', '6C', '6C+',
    '7A', '7A+', '7B', '7B+', '7C', '7C+',
    '8A', '8A+', '8B', '8B+', '8C', '8C+',
    '9A', '9A+',
  ];

  // Utility: class by grade band
  const gradeClass = (grade) => {
    if (!grade) return 'grade-badge-unknown';
    const clean = grade.replace('+', '');
    if (/^[345]$/.test(clean)) return 'grade-badge-easy';
    if (/^6[A-C]?$/.test(clean)) return 'grade-badge-medium';
    if (/^7[A-C]?$/.test(clean)) return 'grade-badge-hard';
    if (/^[89]/.test(clean) || /^9/.test(clean)) return 'grade-badge-pro';
    return 'grade-badge-default';
  };

  useEffect(() => {
    fetchSector();
    fetchProblems();
  }, [id]);

  const fetchSector = async () => {
    try {
      console.log('📡 Fetching sector details for ID:', id);
      setLoading(true);
      const response = await sectorsAPI.get(id);
      console.log('✅ Sector fetched successfully:', response.data);
      setSector(response.data);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch sector:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        request: err.request,
        status: err.response?.status,
      });
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Failed to load sector details.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchProblems = async () => {
    try {
      console.log('📡 Fetching problems for sector ID:', id);
      const response = await sectorsAPI.getProblems(id);
      console.log('✅ Problems fetched successfully:', response.data);
      const fetchedProblems = response.data.results || response.data;
      setAllProblems(fetchedProblems);
      updateAvailableGrades(fetchedProblems);
      filterProblems(fetchedProblems, selectedGrade);
    } catch (err) {
      console.error('❌ Failed to fetch problems:', err);
    }
  };

  const fetchTicks = async () => {
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
      console.error('❌ Failed to fetch ticks:', err);
    }
  };

  const handleTickClick = (problem, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      alert('Please login to tick problems');
      return;
    }

    const tick = ticks[problem.id];
    setSelectedProblemForTick(problem);
    
    if (tick) {
      // Edit existing tick
      setTickFormData({
        date: tick.date || new Date().toISOString().split('T')[0],
        notes: tick.notes || '',
        tick_grade: tick.tick_grade || '',
        suggested_grade: tick.suggested_grade || '',
        rating: tick.rating ? parseFloat(tick.rating) : null,
      });
    } else {
      // New tick - reset form
      setTickFormData({
        date: new Date().toISOString().split('T')[0],
        notes: '',
        tick_grade: '',
        suggested_grade: '',
        rating: null,
      });
    }
    
    setShowTickModal(true);
  };

  const handleTickSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated || !selectedProblemForTick) {
      return;
    }

    const problemId = selectedProblemForTick.id;
    const tick = ticks[problemId];

    try {
      if (tick) {
        // Update existing tick
        const payload = {
          date: tickFormData.date,
          notes: tickFormData.notes,
          tick_grade: tickFormData.tick_grade || null,
          suggested_grade: tickFormData.suggested_grade || null,
        };
        if (tickFormData.rating) {
          payload.rating = parseFloat(tickFormData.rating);
        }
        const response = await ticksAPI.patch(tick.id, payload);
        setTicks(prev => ({
          ...prev,
          [problemId]: response.data,
        }));
        console.log('✅ Tick updated');
      } else {
        // Create new tick
        const payload = {
          problem: problemId,
          date: tickFormData.date,
          notes: tickFormData.notes,
        };
        if (tickFormData.tick_grade) {
          payload.tick_grade = tickFormData.tick_grade;
        }
        if (tickFormData.suggested_grade) {
          payload.suggested_grade = tickFormData.suggested_grade;
        }
        if (tickFormData.rating) {
          payload.rating = parseFloat(tickFormData.rating);
        }
        const response = await ticksAPI.create(payload);
        setTicks(prev => ({
          ...prev,
          [problemId]: response.data,
        }));
        console.log('✅ Tick created');
      }
      
      setShowTickModal(false);
      setSelectedProblemForTick(null);
      setTickFormData({
        date: new Date().toISOString().split('T')[0],
        notes: '',
        tick_grade: '',
        suggested_grade: '',
        rating: null,
      });
    } catch (err) {
      console.error('❌ Failed to save tick:', err);
      alert(`Failed to ${tick ? 'update' : 'create'} tick. Please try again.`);
    }
  };

  const updateAvailableGrades = (problemsList) => {
    const grades = new Set();
    const counts = {};
    
    problemsList.forEach(problem => {
      if (problem.grade) {
        grades.add(problem.grade);
        counts[problem.grade] = (counts[problem.grade] || 0) + 1;
      }
    });
    
    // Sort grades according to GRADE_CHOICES order
    const sortedGrades = GRADE_CHOICES.filter(grade => grades.has(grade));
    setAvailableGrades(sortedGrades);
    setGradeCounts(counts);
  };

  const filterProblems = (problemsList, grade, search = '') => {
    let filtered = problemsList;
    
    // Filter by grade
    if (grade) {
      filtered = filtered.filter(p => p.grade === grade);
    }
    
    // Filter by search term
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      filtered = filtered.filter(p =>
        (p.name || '').toLowerCase().includes(searchLower) ||
        (p.description_preview || '').toLowerCase().includes(searchLower)
      );
    }
    
    setProblems(filtered);
  };

  useEffect(() => {
    if (allProblems.length > 0) {
      filterProblems(allProblems, selectedGrade, searchTerm);
    }
  }, [selectedGrade, searchTerm, allProblems]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isAuthenticated) {
      fetchTicks();
    } else {
      setTicks({});
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close grade dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (gradeFilterRef.current && !gradeFilterRef.current.contains(event.target)) {
        setShowGradeDropdown(false);
        setGradeSearchTerm('');
      }
    };

    if (showGradeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showGradeDropdown]);

  // Filter available grades by search term
  const filteredAvailableGrades = availableGrades.filter(grade =>
    grade.toLowerCase().includes(gradeSearchTerm.toLowerCase())
  );

  // Sort problems
  const sortedProblems = [...problems].sort((a, b) => {
    let aVal, bVal;
    
    switch (sortField) {
      case 'grade':
        const gradeOrder = GRADE_CHOICES;
        // Use -1 for missing grades so they sort to the end
        aVal = a.grade ? gradeOrder.indexOf(a.grade) : -1;
        bVal = b.grade ? gradeOrder.indexOf(b.grade) : -1;
        // If both are missing, keep original order
        if (aVal === -1 && bVal === -1) return 0;
        // Missing grades go to the end
        if (aVal === -1) return 1;
        if (bVal === -1) return -1;
        break;
      case 'name':
        aVal = (a.name || '').toLowerCase();
        bVal = (b.name || '').toLowerCase();
        break;
      case 'ascents':
        aVal = a.tick_count || 0;
        bVal = b.tick_count || 0;
        break;
      case 'author':
        aVal = (a.author_username || '').toLowerCase();
        bVal = (b.author_username || '').toLowerCase();
        break;
      case 'stars':
        aVal = a.average_rating || a.rating || 0;
        bVal = b.average_rating || b.rating || 0;
        break;
      default:
        return 0;
    }
    
    if (sortField === 'name' || sortField === 'author') {
      return sortOrder === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    if (sortOrder === 'asc') {
      return aVal - bVal;
    } else {
      return bVal - aVal;
    }
  });

  if (loading) {
    return (
      <div className="sector-detail-page">
        <div className="loading">Loading sector details...</div>
      </div>
    );
  }

  if (error || !sector) {
    return (
      <div className="sector-detail-page">
        <div className="error">{error || 'Sector not found'}</div>
      </div>
    );
  }

  return (
    <div className="sector-detail-page">
      <Link to={sector.area ? `/crags/${sector.area}` : '/explore'} className="back-link">
        ← Back to {sector.area_name || 'Explore'}
      </Link>
      
      <div className="sector-header">
        <h1>{sector.name}</h1>
        {sector.area_name && (
          <p className="area-name">Area: <Link to={`/crags/${sector.area}`}>{sector.area_name}</Link></p>
        )}
        {sector.description && <p className="description">{sector.description}</p>}
        {sector.latitude && sector.longitude && (
          <p className="coordinates">
            📍 Coordinates: {sector.latitude}, {sector.longitude}
          </p>
        )}
        <div className="stats">
          <span>{problems.length} Problem{problems.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="problems-section">
        <div className="problems-header">
          <h2>Problems ({problems.length})</h2>
          <div className="header-actions">
            {isAuthenticated && (
              <Link to={`/problems/add?sector=${sector.id}`} className="btn btn-primary">
                + Add Problem
              </Link>
            )}
          </div>
        </div>

        {/* Search and Grade Filter */}
        <div className="filters-bar">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Search problems..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              aria-label="Search problems"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="search-clear"
                aria-label="Clear search"
                title="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="grade-filter-wrapper" ref={gradeFilterRef}>
            <button
              onClick={() => setShowGradeDropdown(!showGradeDropdown)}
              className={`grade-filter-toggle ${selectedGrade ? 'active' : ''} ${showGradeDropdown ? 'open' : ''}`}
              aria-expanded={showGradeDropdown}
              aria-haspopup="listbox"
            >
              <span>{selectedGrade ? `Grade: ${selectedGrade}` : 'All Grades'}</span>
              <span className="filter-icon" aria-hidden>▾</span>
            </button>
            {showGradeDropdown && (
              <div className="grade-dropdown" role="listbox" aria-label="Grades">
                <div className="grade-dropdown-search">
                  <input
                    type="text"
                    placeholder="Search grades..."
                    value={gradeSearchTerm}
                    onChange={(e) => setGradeSearchTerm(e.target.value)}
                    className="grade-search-input"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="grade-dropdown-list">
                  <button
                    onClick={() => {
                      setSelectedGrade(null);
                      setShowGradeDropdown(false);
                      setGradeSearchTerm('');
                    }}
                    className={`grade-option ${selectedGrade === null ? 'active' : ''}`}
                    role="option"
                    aria-selected={selectedGrade === null}
                  >
                    All ({allProblems.length})
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
                        className={`grade-option ${selectedGrade === grade ? 'active' : ''}`}
                        role="option"
                        aria-selected={selectedGrade === grade}
                      >
                        {grade} ({gradeCounts[grade] || 0})
                      </button>
                    ))
                  ) : (
                    <div className="grade-option no-results">No grades found</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Clear all filters */}
          {(selectedGrade || searchTerm) && (
            <button
              onClick={() => {
                setSelectedGrade(null);
                setSearchTerm('');
              }}
              className="clear-all-filters"
            >
              Clear all
            </button>
          )}
        </div>

        <div className="problem-group">
          <div className="problems-table-wrapper">
            <table className="problems-table">
              <thead>
                <tr>
                  <th 
                    className={`sortable ${sortField === 'grade' ? `sort-${sortOrder}` : ''}`}
                    onClick={() => {
                      if (sortField === 'grade') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('grade');
                        setSortOrder('desc');
                      }
                    }}
                  >
                    GRADE
                  </th>
                  <th 
                    className={`sortable ${sortField === 'name' ? `sort-${sortOrder}` : ''}`}
                    onClick={() => {
                      if (sortField === 'name') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('name');
                        setSortOrder('asc');
                      }
                    }}
                  >
                    NAME
                  </th>
                  <th>MEDIA</th>
                  <th 
                    className={`sortable ${sortField === 'ascents' ? `sort-${sortOrder}` : ''}`}
                    onClick={() => {
                      if (sortField === 'ascents') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('ascents');
                        setSortOrder('desc');
                      }
                    }}
                  >
                    ASCENTS
                  </th>
                  <th 
                    className={`sortable ${sortField === 'author' ? `sort-${sortOrder}` : ''}`}
                    onClick={() => {
                      if (sortField === 'author') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('author');
                        setSortOrder('asc');
                      }
                    }}
                  >
                    AUTHOR
                  </th>
                  <th 
                    className={`sortable ${sortField === 'stars' ? `sort-${sortOrder}` : ''}`}
                    onClick={() => {
                      if (sortField === 'stars') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortField('stars');
                        setSortOrder('desc');
                      }
                    }}
                  >
                    STARS
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedProblems.length > 0 ? (
                  sortedProblems.map((problem) => (
                    <tr key={problem.id} className="problem-row">
                      <td className="problem-grade-cell">
                        <div 
                          className={`problem-grade-badge ${gradeClass(problem.grade)}`}
                        >
                          {problem.grade || '?'}
                        </div>
                      </td>
                      <td className="problem-name-cell">
                        <Link to={`/problems/${problem.id}`} className="problem-name-link">
                          <div className="problem-name-main">{problem.name}</div>
                          <div className="problem-location">
                            {problem.sector_name || sector.name}
                            {problem.wall_name && `, ${problem.wall_name}`}
                          </div>
                        </Link>
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
                          {isAuthenticated && (
                            <button 
                              className={`tick-btn ${ticks[problem.id] ? 'ticked' : ''}`}
                              onClick={(e) => handleTickClick(problem, e)}
                              title={ticks[problem.id] ? 'Edit tick' : 'Add to tick list'}
                            >
                              {ticks[problem.id] ? '✓' : '+'}
                            </button>
                          )}
                          {isAuthenticated && user && problem.created_by && user.id === problem.created_by && (
                            <Link
                              to={`/problems/${problem.id}/edit`}
                              className="edit-btn"
                              onClick={(e) => e.stopPropagation()}
                              title="Edit problem"
                            >
                              ✎
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="no-problems">No problems found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {problems.length === 0 && (
          <p className="no-problems">No problems added yet.</p>
        )}
      </div>

      {/* Tick Modal */}
      {showTickModal && selectedProblemForTick && (
        <div className="modal-overlay" onClick={() => setShowTickModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{ticks[selectedProblemForTick.id] ? 'Edit Tick' : 'Add Tick'}</h2>
              <button className="modal-close" onClick={() => setShowTickModal(false)}>×</button>
            </div>
            <form onSubmit={handleTickSubmit} className="tick-form">
              <div className="form-group">
                <label htmlFor="tick-date">Date:</label>
                <input
                  type="date"
                  id="tick-date"
                  value={tickFormData.date}
                  onChange={(e) => setTickFormData({ ...tickFormData, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="tick-grade">Grade You Climbed (Optional):</label>
                <select
                  id="tick-grade"
                  value={tickFormData.tick_grade}
                  onChange={(e) => setTickFormData({ ...tickFormData, tick_grade: e.target.value })}
                >
                  <option value="">Same as problem grade ({selectedProblemForTick.grade})</option>
                  {GRADE_CHOICES.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
                <small>If you used easier beta, select the grade you actually climbed. This will be used for your statistics.</small>
              </div>
              <div className="form-group">
                <label htmlFor="suggested-grade">Suggested Grade (Optional):</label>
                <select
                  id="suggested-grade"
                  value={tickFormData.suggested_grade}
                  onChange={(e) => setTickFormData({ ...tickFormData, suggested_grade: e.target.value })}
                >
                  <option value="">No grade suggestion</option>
                  {GRADE_CHOICES.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
                <small>Help the community by suggesting what grade you think this problem is</small>
              </div>
              <div className="form-group">
                <label htmlFor="tick-rating">Rate this Problem (Optional):</label>
                <StarRating
                  rating={tickFormData.rating ? parseFloat(tickFormData.rating) : 0}
                  onChange={(rating) => setTickFormData({ ...tickFormData, rating: rating })}
                  editable={true}
                  size="medium"
                />
                <small>Rate this problem from 1 to 5 stars based on your experience</small>
              </div>
              <div className="form-group">
                <label htmlFor="tick-notes">Notes (Optional):</label>
                <textarea
                  id="tick-notes"
                  value={tickFormData.notes}
                  onChange={(e) => setTickFormData({ ...tickFormData, notes: e.target.value })}
                  rows="3"
                  placeholder="Add any notes about your send..."
                />
              </div>
              <div className="modal-actions">
                {ticks[selectedProblemForTick.id] && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to delete this tick?')) {
                        try {
                          await ticksAPI.delete(ticks[selectedProblemForTick.id].id);
                          setTicks(prev => {
                            const newTicks = { ...prev };
                            delete newTicks[selectedProblemForTick.id];
                            return newTicks;
                          });
                          setShowTickModal(false);
                          setSelectedProblemForTick(null);
                        } catch (err) {
                          console.error('❌ Failed to delete tick:', err);
                          alert('Failed to delete tick. Please try again.');
                        }
                      }
                    }}
                  >
                    Delete Tick
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setShowTickModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {ticks[selectedProblemForTick.id] ? 'Update Tick' : 'Add Tick'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SectorDetail;

