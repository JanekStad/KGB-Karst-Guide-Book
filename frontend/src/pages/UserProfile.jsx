import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { usersAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import StarRating from '../components/StarRating';
import './UserProfile.css';
import './MyTicks.css';

const GRADE_CHOICES = ['3', '3+', '4', '4+', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+', '7A', '7A+', '7B', '7B+', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A', '9A+'];
const STYLE_CHOICES = ['send', 'flash', 'solo'];

const getTickStyle = (tick) => {
  if (tick.notes?.toLowerCase().includes('style:')) {
    const styleMatch = tick.notes.toLowerCase().match(/style:\s*(\w+)/);
    if (styleMatch) {
      const style = styleMatch[1].toLowerCase();
      if (STYLE_CHOICES.includes(style) || style === 'redpoint') {
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
      
      const response = await usersAPI.getUserTicks(id);
      
      if (!response || !response.data) {
        throw new Error('Invalid response structure');
      }
      
      if (!response.data.user) {
        throw new Error('User data not found in response');
      }
      
      setUserData(response.data.user);
      setTicks(Array.isArray(response.data.ticks) ? response.data.ticks : []);
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [ticks.length]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric'
    });
  };

  // Calculate statistics from ticks
  const statistics = useMemo(() => {
    if (!ticks || ticks.length === 0) {
      return {
        total_ticks: 0,
        hardest_grade: '-',
        unique_crags: 0,
        unique_cities: 0,
        average_rating: null,
        rated_problems_count: 0,
        first_send: null,
        latest_send: null,
        climbing_span_years: null,
        grade_distribution: {},
        ticks_per_year: {},
        unique_days: 0,
      };
    }

    const totalTicks = ticks.length;
    
    // Get effective grade (tick_grade if available, otherwise problem grade)
    const getEffectiveGrade = (tick) => {
      return tick.tick_grade || tick.problem?.grade;
    };

    // Hardest grade
    const grades = ticks
      .map(t => getEffectiveGrade(t))
      .filter(Boolean);
    
    const hardestGrade = grades.sort((a, b) => {
      const indexA = GRADE_CHOICES.indexOf(a);
      const indexB = GRADE_CHOICES.indexOf(b);
      return indexB - indexA;
    })[0] || '-';

    // Unique crags/areas
    const uniqueCrags = new Set();
    const uniqueCities = new Set();
    ticks.forEach(tick => {
      const area = tick.problem?.area_detail || tick.problem?.area;
      if (area) {
        const areaObj = typeof area === 'object' ? area : null;
        if (areaObj?.id) {
          uniqueCrags.add(areaObj.id);
          if (areaObj.city) {
            const cityObj = typeof areaObj.city === 'object' ? areaObj.city : null;
            if (cityObj?.id) {
              uniqueCities.add(cityObj.id);
            }
          }
        }
      }
    });

    // Average rating
    const ratedTicks = ticks.filter(t => t.rating);
    const averageRating = ratedTicks.length > 0
      ? ratedTicks.reduce((sum, t) => sum + parseFloat(t.rating || 0), 0) / ratedTicks.length
      : null;

    // Date statistics
    const dates = ticks
      .map(t => t.date)
      .filter(Boolean)
      .map(d => new Date(d))
      .sort((a, b) => a - b);
    
    const firstSend = dates.length > 0 ? dates[0].toISOString() : null;
    const latestSend = dates.length > 0 ? dates[dates.length - 1].toISOString() : null;
    
    // Climbing span in years
    const climbingSpanYears = dates.length > 0
      ? ((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1)
      : null;

    // Unique days
    const uniqueDays = new Set(ticks.map(t => t.date)).size;

    // Grade distribution
    const gradeDistribution = {};
    ticks.forEach(tick => {
      const grade = getEffectiveGrade(tick);
      if (grade) {
        gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
      }
    });

    // Ticks per year
    const ticksPerYear = {};
    ticks.forEach(tick => {
      if (tick.date) {
        const year = new Date(tick.date).getFullYear();
        ticksPerYear[year] = (ticksPerYear[year] || 0) + 1;
      }
    });

    return {
      total_ticks: totalTicks,
      hardest_grade: hardestGrade,
      unique_crags: uniqueCrags.size,
      unique_cities: uniqueCities.size,
      average_rating: averageRating,
      rated_problems_count: ratedTicks.length,
      first_send: firstSend,
      latest_send: latestSend,
      climbing_span_years: climbingSpanYears ? parseFloat(climbingSpanYears) : null,
      grade_distribution: gradeDistribution,
      ticks_per_year: ticksPerYear,
      unique_days: uniqueDays,
    };
  }, [ticks]);

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

  if (!userData || !userData.username) {
    return (
      <div className="user-profile-page">
        <div className="loading">Loading user profile...</div>
      </div>
    );
  }

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
            {userData.profile?.avatar ? (
              <img src={userData.profile.avatar} alt={userData.username} />
            ) : (
              <span>{getInitials(userData.username || 'U')}</span>
            )}
          </div>
          <div className="user-info">
            <h1>{userData.username}&apos;s Profile</h1>
            {userData.profile?.bio && (
              <p className="user-bio">{userData.profile.bio}</p>
            )}
            <div className="user-details">
              {userData.profile?.location && (
                <p className="user-detail-item">
                  <span className="material-symbols-outlined">location_on</span>
                  {userData.profile.location}
                </p>
              )}
              {userData.profile?.height && (
                <p className="user-detail-item">
                  <span className="material-symbols-outlined">height</span>
                  {userData.profile.height} cm
                </p>
              )}
              {userData.profile?.ape_index !== null && userData.profile?.ape_index !== undefined && (
                <p className="user-detail-item">
                  <span className="material-symbols-outlined">straighten</span>
                  Ape Index: {parseFloat(userData.profile.ape_index) > 0 ? '+' : ''}{parseFloat(userData.profile.ape_index).toFixed(1)} cm
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Performance Metrics Card */}
        <div className="performance-metrics-card">
          <div className="card-header">
            <div className="card-title">
              <span className="material-symbols-outlined">bar_chart</span>
              <h3>PERFORMANCE METRICS</h3>
            </div>
          </div>
          <div className="metrics-grid">
            <div className="metric-item">
              <span className="metric-label">Total Sends</span>
              <span className="metric-value">{statistics.total_ticks}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">Hardest Grade</span>
              <span className="metric-value">{statistics.hardest_grade}</span>
            </div>
            {statistics.unique_crags > 0 && (
              <div className="metric-item">
                <span className="metric-label">Crags Visited</span>
                <span className="metric-value">{statistics.unique_crags}</span>
              </div>
            )}
            {statistics.unique_cities > 0 && (
              <div className="metric-item">
                <span className="metric-label">Cities Explored</span>
                <span className="metric-value">{statistics.unique_cities}</span>
              </div>
            )}
            {statistics.average_rating && (
              <div className="metric-item">
                <span className="metric-label">Avg Rating</span>
                <span className="metric-value">{statistics.average_rating.toFixed(1)}</span>
                <span className="metric-subtext">({statistics.rated_problems_count} rated)</span>
              </div>
            )}
            {statistics.climbing_span_years && (
              <div className="metric-item">
                <span className="metric-label">Years Climbing</span>
                <span className="metric-value">{statistics.climbing_span_years}</span>
              </div>
            )}
            {statistics.unique_days > 0 && (
              <div className="metric-item">
                <span className="metric-label">Days Out</span>
                <span className="metric-value">{statistics.unique_days}</span>
              </div>
            )}
            {statistics.first_send && (
              <div className="metric-item">
                <span className="metric-label">First Send</span>
                <span className="metric-value-small">
                  {new Date(statistics.first_send).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Grade Distribution Card */}
        {statistics.grade_distribution && Object.keys(statistics.grade_distribution).length > 0 && (
          <div className="grade-pyramid-card">
            <div className="card-header">
              <div className="card-title">
                <h3>Grade Pyramid</h3>
                <span className="card-subtitle">All time • Font Scale</span>
              </div>
            </div>
            <div className="grade-pyramid">
              {Object.entries(statistics.grade_distribution)
                .filter(([_, count]) => count > 0)
                .sort((a, b) => {
                  const gradeA = GRADE_CHOICES.indexOf(a[0]);
                  const gradeB = GRADE_CHOICES.indexOf(b[0]);
                  return gradeA - gradeB;
                })
                .map(([grade, count]) => {
                  const maxCount = Math.max(...Object.values(statistics.grade_distribution).filter(c => c > 0));
                  const widthPercentage = (count / maxCount) * 100;
                  return (
                    <div key={grade} className="grade-pyramid-item">
                      <span className="grade-pyramid-grade">{grade}</span>
                      <div className="grade-pyramid-bar-container">
                        <div 
                          className="grade-pyramid-bar" 
                          style={{ width: `${widthPercentage}%` }}
                        />
                      </div>
                      <span className="grade-pyramid-count">{count}</span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Activity by Year Chart */}
        {statistics.ticks_per_year && Object.keys(statistics.ticks_per_year).length > 0 && (
          <div className="grade-pyramid-card">
            <div className="card-header">
              <div className="card-title">
                <h3>Activity by Year</h3>
              </div>
            </div>
            <div className="year-activity-chart">
              {Object.entries(statistics.ticks_per_year)
                .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                .map(([year, count]) => {
                  const maxCount = Math.max(...Object.values(statistics.ticks_per_year));
                  const heightPercentage = (count / maxCount) * 100;
                  return (
                    <div 
                      key={year} 
                      className="year-activity-item" 
                      title={`${count} ascents in ${year}`}
                    >
                      <div className="year-activity-bar-container">
                        <div 
                          className="year-activity-bar" 
                          style={{ height: `${heightPercentage}%` }}
                        />
                      </div>
                      <div className="year-activity-label">
                        <span className="year-activity-year">{year}</span>
                        <span className="year-activity-count">{count}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Ticks List */}
        <div className="user-ticks-section">
          <h2>Climbing History</h2>
          {ticks.length === 0 ? (
            <div className="empty-state">
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
                      const slots = [];
                      
                      if (currentPage <= 3) {
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
