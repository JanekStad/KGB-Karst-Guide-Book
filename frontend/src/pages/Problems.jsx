import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StarRating from '../components/StarRating';
import { useAuth } from '../contexts/AuthContext';
import { cragsAPI, problemsAPI, wallsAPI } from '../services/api';
import './Problems.css';

const Problems = () => {
  const { isAuthenticated } = useAuth();
  const [problems, setProblems] = useState([]);
  const [allProblems, setAllProblems] = useState([]); // For client-side rating filter
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedCrag, setSelectedCrag] = useState('');
  const [selectedWall, setSelectedWall] = useState('');
  const [selectedMinRating, setSelectedMinRating] = useState('');
  const [crags, setCrags] = useState([]);
  const [walls, setWalls] = useState([]);
  const [availableGrades, setAvailableGrades] = useState([]);
  const [pagination, setPagination] = useState({
    count: 0,
    next: null,
    previous: null,
    currentPage: 1,
    totalPages: 1,
  });
  const [filteredCount, setFilteredCount] = useState(0); // Count after client-side rating filter
  const PAGE_SIZE = 21;

  const GRADE_CHOICES = [
    '', '3', '3+', '4', '4+', '5', '5+',
    '6A', '6A+', '6B', '6B+', '6C', '6C+',
    '7A', '7A+', '7B', '7B+', '7C', '7C+',
    '8A', '8A+', '8B', '8B+', '8C', '8C+',
    '9A',
  ];

  const RATING_CHOICES = [
    { value: '', label: 'Any Rating' },
    { value: '4.5', label: '4.5+ ⭐' },
    { value: '4.0', label: '4.0+ ⭐' },
    { value: '3.5', label: '3.5+ ⭐' },
    { value: '3.0', label: '3.0+ ⭐' },
    { value: '2.5', label: '2.5+ ⭐' },
    { value: '2.0', label: '2.0+ ⭐' },
    { value: '1.5', label: '1.5+ ⭐' },
    { value: '1.0', label: '1.0+ ⭐' },
  ];

  // Fetch crags on mount
  useEffect(() => {
    fetchCrags();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch walls when crag changes
  useEffect(() => {
    if (selectedCrag) {
      fetchWalls(selectedCrag);
    } else {
      setWalls([]);
      setSelectedWall('');
    }
  }, [selectedCrag]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch problems when filters change (including initial mount)
  useEffect(() => {
    fetchProblems(1);
  }, [selectedGrade, selectedCrag, selectedWall]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCrags = async () => {
    try {
      const response = await cragsAPI.list();
      const fetchedCrags = response.data.results || response.data;
      setCrags(fetchedCrags || []);
    } catch (err) {
      console.error('❌ Failed to fetch crags:', err);
    }
  };

  const fetchWalls = async (cragId) => {
    try {
      const response = await wallsAPI.list({ crag: cragId });
      const fetchedWalls = response.data.results || response.data;
      setWalls(fetchedWalls || []);
    } catch (err) {
      console.error('❌ Failed to fetch walls:', err);
      setWalls([]);
    }
  };

  const fetchProblems = async (page = 1) => {
    try {
      console.log('📡 Fetching problems...', { searchTerm, page, selectedGrade, selectedCrag, selectedWall });
      setLoading(true);
      const params = {
        page: page,
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(selectedGrade ? { grade: selectedGrade } : {}),
        ...(selectedCrag ? { crag: selectedCrag } : {}),
        ...(selectedWall ? { wall: selectedWall } : {}),
      };
      const response = await problemsAPI.list(params);
      console.log('✅ Problems fetched successfully:', response.data);
      
      // Handle paginated response
      if (response.data.results) {
        const fetchedProblems = response.data.results;
        // Store all problems for client-side rating filtering
        setAllProblems(fetchedProblems);
        // Apply rating filter if selected
        const filteredProblems = applyRatingFilter(fetchedProblems);
        setProblems(filteredProblems);
        // Update filtered count for pagination display
        setFilteredCount(filteredProblems.length);
        setPagination({
          count: response.data.count || 0,
          next: response.data.next,
          previous: response.data.previous,
          currentPage: page,
          totalPages: Math.ceil((response.data.count || 0) / PAGE_SIZE),
        });
        // Update available grades from current page
        updateAvailableGrades(fetchedProblems);
      } else {
        // Non-paginated response (fallback)
        const fetchedProblems = response.data;
        setAllProblems(fetchedProblems);
        const filteredProblems = applyRatingFilter(fetchedProblems);
        setProblems(filteredProblems);
        // Update filtered count for pagination display
        setFilteredCount(filteredProblems.length);
        setPagination({
          count: response.data.length || 0,
          next: null,
          previous: null,
          currentPage: 1,
          totalPages: 1,
        });
        updateAvailableGrades(response.data);
      }
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch problems:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        request: err.request,
      });
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Failed to load problems. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const applyRatingFilter = (problemsList) => {
    if (!selectedMinRating || selectedMinRating === '') {
      return problemsList;
    }
    const minRating = parseFloat(selectedMinRating);
    return problemsList.filter(problem => {
      const rating = parseFloat(problem.average_rating || problem.rating || 0);
      return rating >= minRating;
    });
  };

  // Apply rating filter when it changes
  useEffect(() => {
    if (allProblems.length > 0) {
      const filtered = applyRatingFilter(allProblems);
      setProblems(filtered);
      // Update filtered count for pagination display
      setFilteredCount(filtered.length);
    } else {
      setFilteredCount(0);
    }
  }, [selectedMinRating, allProblems]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProblems(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedGrade('');
    setSelectedCrag('');
    setSelectedWall('');
    setSelectedMinRating('');
  };

  const hasActiveFilters = () => {
    return selectedGrade || selectedCrag || selectedWall || selectedMinRating || searchTerm;
  };

  const updateAvailableGrades = (problemsList) => {
    if (!problemsList || problemsList.length === 0) return;
    
    // Use functional updates to merge with existing state
    setAvailableGrades(prevGrades => {
      const currentGrades = new Set(prevGrades);
      
      problemsList.forEach(problem => {
        if (problem.grade) {
          currentGrades.add(problem.grade);
        }
      });
      
      // Sort grades according to GRADE_CHOICES order (excluding empty string)
      return GRADE_CHOICES.filter(grade => grade && currentGrades.has(grade));
    });
  };

  const handlePageChange = (newPage) => {
    fetchProblems(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="problems-page">
        <div className="loading">Loading problems...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="problems-page">
        <div className="error">
          <h3>Error loading problems</h3>
          <p>{error}</p>
          <button onClick={fetchProblems} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="problems-page">
      <div className="page-header">
        <div className="header-top">
          <h1>Boulder Problems</h1>
          {isAuthenticated && (
            <Link to="/problems/add" className="btn btn-primary">
              + Add Problem
            </Link>
          )}
        </div>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search problems..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>

        {/* Filters Section */}
        <div className="filters-section">
          <div className="filters-header">
            <h2 className="filters-title">Filters</h2>
            {hasActiveFilters() && (
              <button
                onClick={handleClearFilters}
                className="btn-clear-filters"
              >
                Clear All
              </button>
            )}
          </div>
          
          <div className="filters-grid">
            {/* Crag Filter */}
            <div className="filter-group">
              <label htmlFor="crag-filter" className="filter-label">
                Crag
              </label>
              <select
                id="crag-filter"
                value={selectedCrag}
                onChange={(e) => setSelectedCrag(e.target.value)}
                className="filter-select"
              >
                <option value="">All Crags</option>
                {crags.map((crag) => (
                  <option key={crag.id} value={crag.id}>
                    {crag.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Wall Filter */}
            <div className="filter-group">
              <label htmlFor="wall-filter" className="filter-label">
                Wall
              </label>
              <select
                id="wall-filter"
                value={selectedWall}
                onChange={(e) => setSelectedWall(e.target.value)}
                className="filter-select"
                disabled={!selectedCrag}
              >
                <option value="">All Walls</option>
                {walls.map((wall) => (
                  <option key={wall.id} value={wall.id}>
                    {wall.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Grade Filter */}
            <div className="filter-group">
              <label htmlFor="grade-filter" className="filter-label">
                Grade
              </label>
              <select
                id="grade-filter"
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="filter-select"
              >
                <option value="">All Grades</option>
                {availableGrades.length > 0 ? (
                  availableGrades.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))
                ) : (
                  GRADE_CHOICES.filter(g => g).map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Rating Filter */}
            <div className="filter-group">
              <label htmlFor="rating-filter" className="filter-label">
                Min Rating
              </label>
              <select
                id="rating-filter"
                value={selectedMinRating}
                onChange={(e) => setSelectedMinRating(e.target.value)}
                className="filter-select"
              >
                {RATING_CHOICES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="problems-grid">
        {problems.length === 0 ? (
          <div className="empty-state">
            <p>No problems found. Be the first to add one!</p>
          </div>
        ) : (
          problems.map((problem) => (
            <Link
              key={problem.id}
              to={`/problems/${problem.id}`}
              className="problem-card"
            >
              <div className="problem-grade-badge">{problem.grade}</div>
              <div className="problem-info">
                <h3>{problem.name}</h3>
                {problem.crag_name && (
                  <p className="crag-name">
                    📍 {problem.crag_name}
                    {problem.wall_name && ` - ${problem.wall_name}`}
                  </p>
                )}
                {(problem.average_rating || problem.rating) && (
                  <div className="problem-rating-inline">
                    <StarRating 
                      rating={parseFloat(problem.average_rating || problem.rating)} 
                      size="small" 
                    />
                  </div>
                )}
                {problem.tick_count !== undefined && (
                  <p className="tick-count">
                    {problem.tick_count} tick{problem.tick_count !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
              {problem.primary_image && (
                <div className="problem-image">
                  <img src={problem.primary_image} alt={problem.name} />
                </div>
              )}
            </Link>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <div className="pagination-info">
            {selectedMinRating ? (
              // When rating filter is active, show filtered count for current page
              filteredCount > 0 ? (
                `Showing ${filteredCount} of ${allProblems.length} problems on this page (filtered by rating)`
              ) : (
                `No problems match the rating filter on this page (${allProblems.length} total on page ${pagination.currentPage})`
              )
            ) : (
              // When no rating filter, show backend pagination counts
              `Showing ${((pagination.currentPage - 1) * PAGE_SIZE) + 1} - ${Math.min(pagination.currentPage * PAGE_SIZE, pagination.count)} of ${pagination.count} problems`
            )}
          </div>
          <div className="pagination-controls">
            <button
              onClick={() => handlePageChange(pagination.currentPage - 1)}
              disabled={!pagination.previous}
              className="btn btn-secondary"
            >
              ← Previous
            </button>
            <span className="pagination-page">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.currentPage + 1)}
              disabled={!pagination.next}
              className="btn btn-secondary"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Problems;

