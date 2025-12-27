import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import StarRating from '../components/StarRating';
import './UserProfile.css';
import './MyTicks.css';

const UserProfile = () => {
  const { id } = useParams();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [ticks, setTicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const fetchUserProfile = useCallback(async () => {
    if (!id) {
      setError('User ID is required');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      console.log('Fetching user profile for ID:', id);
      const response = await usersAPI.getUserTicks(id);
      console.log('User profile response:', response);
      
      // Validate response structure
      if (!response) {
        throw new Error('No response from server');
      }
      
      if (!response.data) {
        throw new Error('Invalid response structure: missing data');
      }
      
      if (!response.data.user) {
        throw new Error('User data not found in response');
      }
      
      console.log('Setting user data:', response.data.user);
      setUserData(response.data.user);
      setTicks(Array.isArray(response.data.ticks) ? response.data.ticks : []);
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        data: err.response?.data,
      });
      const errorMessage = err.response?.data?.detail || err.response?.data?.error || err.message || 'Failed to load user profile. Please try again.';
      setError(errorMessage);
      setUserData(null);
      setTicks([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      setError('User ID is required');
      setLoading(false);
      return;
    }
    
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    fetchUserProfile();
  }, [id, isAuthenticated, navigate, fetchUserProfile]);

  // Reset to page 1 when ticks change
  useEffect(() => {
    setCurrentPage(1);
  }, [ticks.length]);

  // Early return checks - must be after all hooks
  if (!id) {
    return (
      <div className="user-profile-page">
        <div className="error">Invalid user ID</div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="user-profile-page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getTickStyle = (tick) => {
    // Default to 'send' since there's no style field in the model
    if (tick.notes?.toLowerCase().includes('style:')) {
      const styleMatch = tick.notes.toLowerCase().match(/style:\s*(\w+)/);
      if (styleMatch) {
        const style = styleMatch[1].toLowerCase();
        if (['send', 'flash', 'solo'].includes(style) || style === 'redpoint') {
          return style === 'redpoint' ? 'send' : style;
        }
      }
    }
    return 'send';
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="user-profile-page">
        <div className="loading">Loading user profile...</div>
      </div>
    );
  }

  if (error || !userData) {
    return (
      <div className="user-profile-page">
        <div className="error">{error || 'User not found'}</div>
      </div>
    );
  }

  // Ensure userData exists before calculating stats
  if (!userData || !userData.username) {
    return (
      <div className="user-profile-page">
        <div className="loading">Loading user profile...</div>
      </div>
    );
  }

  // Calculate basic stats
  const totalTicks = ticks.length;
  const uniqueGrades = new Set(ticks.map(t => t.tick_grade || t.problem?.grade).filter(Boolean));
  const hardestGrade = Array.from(uniqueGrades).sort((a, b) => {
    const gradeOrder = ['3', '3+', '4', '4+', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+', '7A', '7A+', '7B', '7B+', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A', '9A+'];
    return gradeOrder.indexOf(b) - gradeOrder.indexOf(a);
  })[0] || '-';

  // Pagination
  const totalPages = Math.ceil(ticks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTicks = ticks.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="user-profile-page">
      <div className="user-profile-container">
        {/* User Header */}
        <div className="user-profile-header">
          <div className="user-avatar-large">
            {getInitials(userData.username || 'U')}
          </div>
          <div className="user-info">
            <h1>{userData.username}&apos;s Profile</h1>
            {userData.profile?.bio && (
              <p className="user-bio">{userData.profile.bio}</p>
            )}
            {userData.profile?.location && (
              <p className="user-location">
                <span className="material-symbols-outlined">location_on</span>
                {userData.profile.location}
              </p>
            )}
          </div>
        </div>

        {/* Stats Summary */}
        <div className="user-stats-summary">
          <div className="stat-item">
            <span className="stat-value">{totalTicks}</span>
            <span className="stat-label">Total Sends</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{hardestGrade}</span>
            <span className="stat-label">Hardest Grade</span>
          </div>
          {userData.profile?.tick_count !== undefined && (
            <div className="stat-item">
              <span className="stat-value">{userData.profile.tick_count}</span>
              <span className="stat-label">Problems Climbed</span>
            </div>
          )}
        </div>

        {/* Ticks List */}
        <div className="user-ticks-section">
          <h2>Climbing History</h2>
          {ticks.length === 0 ? (
            <div className="user-profile-page empty-state">
              <p>This user hasn&apos;t ticked any boulder problems yet.</p>
            </div>
          ) : (
            <div className="dashboard-table-container">
              <div className="table-wrapper">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Grade</th>
                      <th>Route Name</th>
                      <th>Crag / Area</th>
                      <th>Date</th>
                      <th>Style</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedTicks.map((tick) => (
                      <tr key={tick.id}>
                        <td className="grade-cell">
                          {tick.problem && tick.tick_grade && tick.tick_grade !== tick.problem.grade ? (
                            <>
                              <span title="Grade they climbed">{tick.tick_grade}</span>
                              <span> / </span>
                              <span title="Problem grade">{tick.problem.grade}</span>
                            </>
                          ) : (
                            tick.problem?.grade || '-'
                          )}
                        </td>
                        <td className="route-cell">
                          <div className="route-cell-content">
                            {tick.problem ? (
                              <Link to={`/problems/${tick.problem.id}`} className="route-link">
                                {tick.problem.name}
                              </Link>
                            ) : (
                              <span>Unknown Problem</span>
                            )}
                            {tick.rating && (
                              <span className="route-rating">
                                <StarRating rating={parseFloat(tick.rating)} size="small" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="crag-cell">
                          {(() => {
                            const area = tick.problem?.area_detail || tick.problem?.area;
                            if (area && (typeof area === 'object' ? area.id : area)) {
                              const areaId = typeof area === 'object' ? area.id : area;
                              const areaName = typeof area === 'object' ? area.name : 'Unknown Area';
                              return (
                                <Link to={`/areas/${areaId}`}>
                                  {areaName}
                                </Link>
                              );
                            }
                            return '-';
                          })()}
                        </td>
                        <td className="date-cell">{formatDate(tick.date)}</td>
                        <td className="style-cell">
                          {(() => {
                            const style = getTickStyle(tick);
                            const styleLabels = {
                              'send': 'Send',
                              'flash': 'Flash',
                              'solo': 'Solo'
                            };
                            const styleClass = style === 'flash' ? 'style-flash' : 'style-redpoint';
                            return (
                              <span className={`style-badge ${styleClass}`}>
                                {styleLabels[style] || 'Send'}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination">
                  <div className="pagination-info">
                    Showing <span>{startIndex + 1}</span> to{' '}
                    <span>{Math.min(startIndex + itemsPerPage, ticks.length)}</span> of{' '}
                    <span>{ticks.length}</span> results
                  </div>
                  <div className="pagination-compact">
                    <button
                      className="pagination-compact-button"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      aria-label="Previous page"
                    >
                      <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    
                    {(() => {
                      // Always show 7 page slots for consistent size
                      const slots = [];
                      
                      if (currentPage <= 3) {
                        // Show: 1 2 3 4 5 ... last
                        for (let i = 1; i <= 5 && i <= totalPages; i++) {
                          slots.push(
                            <button
                              key={i}
                              className={`pagination-compact-page ${currentPage === i ? 'active' : ''}`}
                              onClick={() => setCurrentPage(i)}
                            >
                              {i}
                            </button>
                          );
                        }
                        if (totalPages > 5) {
                          slots.push(<span key="ellipsis1" className="pagination-compact-ellipsis">...</span>);
                          slots.push(
                            <button
                              key={totalPages}
                              className={`pagination-compact-page ${currentPage === totalPages ? 'active' : ''}`}
                              onClick={() => setCurrentPage(totalPages)}
                            >
                              {totalPages}
                            </button>
                          );
                        }
                      } else if (currentPage >= totalPages - 2) {
                        // Show: 1 ... last-4 last-3 last-2 last-1 last
                        slots.push(
                          <button
                            key={1}
                            className={`pagination-compact-page ${currentPage === 1 ? 'active' : ''}`}
                            onClick={() => setCurrentPage(1)}
                          >
                            1
                          </button>
                        );
                        if (totalPages > 5) {
                          slots.push(<span key="ellipsis1" className="pagination-compact-ellipsis">...</span>);
                          const start = Math.max(totalPages - 4, 2);
                          for (let i = start; i <= totalPages; i++) {
                            slots.push(
                              <button
                                key={i}
                                className={`pagination-compact-page ${currentPage === i ? 'active' : ''}`}
                                onClick={() => setCurrentPage(i)}
                              >
                                {i}
                              </button>
                            );
                          }
                        }
                      } else {
                        // Show: 1 ... current-1 current current+1 ... last
                        slots.push(
                          <button
                            key={1}
                            className={`pagination-compact-page ${currentPage === 1 ? 'active' : ''}`}
                            onClick={() => setCurrentPage(1)}
                          >
                            1
                          </button>
                        );
                        slots.push(<span key="ellipsis1" className="pagination-compact-ellipsis">...</span>);
                        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                          slots.push(
                            <button
                              key={i}
                              className={`pagination-compact-page ${currentPage === i ? 'active' : ''}`}
                              onClick={() => setCurrentPage(i)}
                            >
                              {i}
                            </button>
                          );
                        }
                        slots.push(<span key="ellipsis2" className="pagination-compact-ellipsis">...</span>);
                        slots.push(
                          <button
                            key={totalPages}
                            className={`pagination-compact-page ${currentPage === totalPages ? 'active' : ''}`}
                            onClick={() => setCurrentPage(totalPages)}
                          >
                            {totalPages}
                          </button>
                        );
                      }
                      
                      return slots;
                    })()}
                    
                    <button
                      className="pagination-compact-button"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      aria-label="Next page"
                    >
                      <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;

