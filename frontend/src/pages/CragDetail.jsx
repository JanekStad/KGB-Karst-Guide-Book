import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StarRating from '../components/StarRating';
import { useAuth } from '../contexts/AuthContext';
import { cragsAPI } from '../services/api';
import './CragDetail.css';

const CragDetail = () => {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const [crag, setCrag] = useState(null);
  const [problems, setProblems] = useState([]);
  const [allProblems, setAllProblems] = useState([]);
  const [availableGrades, setAvailableGrades] = useState([]);
  const [gradeCounts, setGradeCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [groupByWall, setGroupByWall] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState(null);

  const GRADE_CHOICES = [
    '3', '3+', '4', '4+', '5', '5+',
    '6A', '6A+', '6B', '6B+', '6C', '6C+',
    '7A', '7A+', '7B', '7B+', '7C', '7C+',
    '8A', '8A+', '8B', '8B+', '8C', '8C+',
    '9A',
  ];

  useEffect(() => {
    fetchCrag();
    fetchProblems();
  }, [id]);

  const fetchCrag = async () => {
    try {
      console.log('📡 Fetching crag details for ID:', id);
      setLoading(true);
      const response = await cragsAPI.get(id);
      console.log('✅ Crag fetched successfully:', response.data);
      setCrag(response.data);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch crag:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        request: err.request,
        status: err.response?.status,
      });
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Failed to load crag details.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchProblems = async () => {
    try {
      console.log('📡 Fetching problems for crag ID:', id);
      const response = await cragsAPI.getProblems(id);
      console.log('✅ Problems fetched successfully:', response.data);
      const fetchedProblems = response.data.results || response.data;
      setAllProblems(fetchedProblems);
      updateAvailableGrades(fetchedProblems);
      filterProblems(fetchedProblems, selectedGrade);
    } catch (err) {
      console.error('❌ Failed to fetch problems:', err);
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

  const filterProblems = (problemsList, grade) => {
    if (!grade) {
      setProblems(problemsList);
    } else {
      setProblems(problemsList.filter(p => p.grade === grade));
    }
  };

  useEffect(() => {
    if (allProblems.length > 0) {
      filterProblems(allProblems, selectedGrade);
    }
  }, [selectedGrade, allProblems]); // eslint-disable-line react-hooks/exhaustive-deps

  // Group problems by wall if groupByWall is true
  const groupedProblems = groupByWall && crag.walls && crag.walls.length > 0
    ? (() => {
        // Create a map of all walls from the crag
        const wallMap = new Map();
        crag.walls.forEach(wall => {
          wallMap.set(wall.name, []);
        });
        
        // Add problems to their respective walls
        problems.forEach(problem => {
          const wallKey = problem.wall_name || 'No Wall';
          if (wallMap.has(wallKey)) {
            wallMap.get(wallKey).push(problem);
          } else {
            // If wall doesn't exist in crag.walls, add to "No Wall" group
            if (!wallMap.has('No Wall')) {
              wallMap.set('No Wall', []);
            }
            wallMap.get('No Wall').push(problem);
          }
        });
        
        // Convert map to object, preserving wall order
        const result = {};
        crag.walls.forEach(wall => {
          result[wall.name] = wallMap.get(wall.name) || [];
        });
        // Add "No Wall" group if it exists
        if (wallMap.has('No Wall') && wallMap.get('No Wall').length > 0) {
          result['No Wall'] = wallMap.get('No Wall');
        }
        return result;
      })()
    : { 'All Problems': problems };

  if (loading) {
    return (
      <div className="crag-detail-page">
        <div className="loading">Loading crag details...</div>
      </div>
    );
  }

  if (error || !crag) {
    return (
      <div className="crag-detail-page">
        <div className="error">{error || 'Crag not found'}</div>
      </div>
    );
  }

  return (
    <div className="crag-detail-page">
      <Link to="/crags" className="back-link">← Back to Crags</Link>
      
      <div className="crag-header">
        <h1>{crag.name}</h1>
        {crag.description && <p className="description">{crag.description}</p>}
        {crag.latitude && crag.longitude && (
          <p className="coordinates">
            📍 Coordinates: {crag.latitude}, {crag.longitude}
          </p>
        )}
        <div className="stats">
          <span>{problems.length} Problem{problems.length !== 1 ? 's' : ''}</span>
          {crag.walls && crag.walls.length > 0 && (
            <>
              <span>•</span>
              <span>{crag.walls.length} Wall{crag.walls.length !== 1 ? 's' : ''}</span>
            </>
          )}
        </div>
      </div>

      <div className="problems-section">
        <div className="problems-header">
          <h2>Problems ({problems.length})</h2>
          <div className="header-actions">
            {crag.walls && crag.walls.length > 0 && (
              <button
                onClick={() => setGroupByWall(!groupByWall)}
                className="btn btn-secondary"
              >
                {groupByWall ? 'Show All' : 'Group by Wall'}
              </button>
            )}
            {isAuthenticated && (
              <Link to={`/crags/${crag.id}/problems/add`} className="btn btn-primary">
                + Add Problem
              </Link>
            )}
          </div>
        </div>

        {/* Grade Filter */}
        <div className="grade-filters">
          <div className="grade-filters-header">
            <div className="grade-filters-label">Filter by Grade:</div>
            {selectedGrade && (
              <button
                onClick={() => setSelectedGrade(null)}
                className="btn-clear-filters"
              >
                Clear Filter
              </button>
            )}
          </div>
          <div className="grade-buttons">
            <button
              onClick={() => setSelectedGrade(null)}
              className={`grade-btn ${selectedGrade === null ? 'active' : ''}`}
            >
              All
            </button>
            {availableGrades.map((grade) => (
              <button
                key={grade}
                onClick={() => setSelectedGrade(selectedGrade === grade ? null : grade)}
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

        {Object.keys(groupedProblems).map((groupName) => (
          <div key={groupName} className="problem-group">
            {groupByWall && <h3 className="wall-name">{groupName}</h3>}
            <div className="problems-list">
              {groupedProblems[groupName].length > 0 ? (
                groupedProblems[groupName].map((problem) => (
                  <Link
                    key={problem.id}
                    to={`/problems/${problem.id}`}
                    className="problem-item"
                  >
                    <div className="problem-left">
                      <div className="problem-grade">{problem.grade}</div>
                      <div className="problem-info">
                        <div className="problem-name">{problem.name}</div>
                        {problem.description_preview && (
                          <div className="problem-description-preview">
                            {problem.description_preview}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="problem-stats-panel">
                      {(problem.average_rating || problem.rating) && (
                        <div className="stat-item">
                          <StarRating 
                            rating={parseFloat(problem.average_rating || problem.rating)} 
                            size="small" 
                          />
                        </div>
                      )}
                      {problem.tick_count !== undefined && problem.tick_count > 0 && (
                        <div className="stat-item">
                          <span className="stat-icon">✓</span>
                          <span className="stat-value">{problem.tick_count}</span>
                          <span className="stat-label">tick{problem.tick_count !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                      {problem.has_video && (
                        <div className="stat-item">
                          <span className="stat-icon">▶</span>
                          <span className="stat-label">Video</span>
                        </div>
                      )}
                      {problem.has_external_links && (
                        <div className="stat-item">
                          <span className="stat-icon">🔗</span>
                          <span className="stat-label">Links</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              ) : (
                <p className="no-problems">No problems in this group.</p>
              )}
            </div>
          </div>
        ))}

        {problems.length === 0 && (
          <p className="no-problems">No problems added yet.</p>
        )}
      </div>
    </div>
  );
};

export default CragDetail;
