import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { problemsAPI } from '../services/api';
import './Problems.css';

const Problems = () => {
  const { isAuthenticated } = useAuth();
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState(null);
  const [availableGrades, setAvailableGrades] = useState([]);
  const [gradeCounts, setGradeCounts] = useState({});
  const [pagination, setPagination] = useState({
    count: 0,
    next: null,
    previous: null,
    currentPage: 1,
    totalPages: 1,
  });
  const PAGE_SIZE = 21;

  const GRADE_CHOICES = [
    '3', '3+', '4', '4+', '5', '5+',
    '6A', '6A+', '6B', '6B+', '6C', '6C+',
    '7A', '7A+', '7B', '7B+', '7C', '7C+',
    '8A', '8A+', '8B', '8B+', '8C', '8C+',
    '9A',
  ];

  useEffect(() => {
    fetchProblems(1);
  }, [selectedGrade]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Fetch available grades on initial load
    fetchAvailableGrades();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAvailableGrades = async () => {
    try {
      // Fetch first page without filters to get available grades
      // We'll get grades from the first page, and update as user navigates
      const response = await problemsAPI.list({ page: 1 });
      const problems = response.data.results || response.data;
      if (problems && problems.length > 0) {
        updateAvailableGrades(problems);
      }
    } catch (err) {
      console.error('❌ Failed to fetch available grades:', err);
    }
  };

  const fetchProblems = async (page = 1) => {
    try {
      console.log('📡 Fetching problems...', { searchTerm, page });
      setLoading(true);
      const params = {
        page: page,
        ...(searchTerm ? { search: searchTerm } : {}),
        ...(selectedGrade ? { grade: selectedGrade } : {}),
      };
      const response = await problemsAPI.list(params);
      console.log('✅ Problems fetched successfully:', response.data);
      
      // Handle paginated response
      if (response.data.results) {
        const fetchedProblems = response.data.results;
        setProblems(fetchedProblems);
        setPagination({
          count: response.data.count || 0,
          next: response.data.next,
          previous: response.data.previous,
          currentPage: page,
          totalPages: Math.ceil((response.data.count || 0) / PAGE_SIZE),
        });
        // Update available grades from current page (adds to existing set)
        updateAvailableGrades(fetchedProblems);
      } else {
        // Non-paginated response (fallback)
        setProblems(response.data);
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

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProblems(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedGrade(null);
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
      
      // Sort grades according to GRADE_CHOICES order
      return GRADE_CHOICES.filter(grade => currentGrades.has(grade));
    });
    
    setGradeCounts(prevCounts => {
      const currentCounts = { ...prevCounts };
      
      problemsList.forEach(problem => {
        if (problem.grade) {
          // For counts, we only track from current page (not accurate total, but shows presence)
          if (!currentCounts[problem.grade]) {
            currentCounts[problem.grade] = 0;
          }
          currentCounts[problem.grade] += 1;
        }
      });
      
      return currentCounts;
    });
  };

  const handleGradeFilter = (grade) => {
    setSelectedGrade(selectedGrade === grade ? null : grade);
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

        {/* Grade Filter */}
        <div className="grade-filters">
          <div className="grade-filters-header">
            <div className="grade-filters-label">Filter by Grade:</div>
            {(selectedGrade || searchTerm) && (
              <button
                onClick={handleClearFilters}
                className="btn-clear-filters"
              >
                Clear Filters
              </button>
            )}
          </div>
          <div className="grade-buttons">
            <button
              onClick={() => handleGradeFilter(null)}
              className={`grade-btn ${selectedGrade === null ? 'active' : ''}`}
            >
              All
            </button>
            {availableGrades.map((grade) => (
              <button
                key={grade}
                onClick={() => handleGradeFilter(grade)}
                className={`grade-btn ${selectedGrade === grade ? 'active' : ''}`}
                title={`${gradeCounts[grade] || 0} problem${(gradeCounts[grade] || 0) !== 1 ? 's' : ''}`}
              >
                {grade}
                {gradeCounts[grade] > 0 && (
                  <span className="grade-count"> ({gradeCounts[grade]})</span>
                )}
              </button>
            ))}
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
            Showing {((pagination.currentPage - 1) * PAGE_SIZE) + 1} - {Math.min(pagination.currentPage * PAGE_SIZE, pagination.count)} of {pagination.count} problems
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

