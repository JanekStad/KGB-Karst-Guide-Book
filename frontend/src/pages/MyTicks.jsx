import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ticksAPI } from '../services/api';
import './MyTicks.css';

const MyTicks = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [ticks, setTicks] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchTicks();
    fetchStatistics();
  }, [isAuthenticated, navigate]);

  const fetchTicks = async () => {
    try {
      setLoading(true);
      const response = await ticksAPI.list();
      setTicks(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch ticks:', err);
      setError('Failed to load your ticks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      setStatsLoading(true);
      const response = await ticksAPI.getStatistics();
      setStatistics(response.data);
    } catch (err) {
      console.error('Failed to fetch statistics:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleDelete = async (tickId) => {
    if (!window.confirm('Are you sure you want to delete this tick?')) {
      return;
    }

    try {
      await ticksAPI.delete(tickId);
      setTicks(ticks.filter(tick => tick.id !== tickId));
      // Refresh statistics after deletion
      fetchStatistics();
    } catch (err) {
      console.error('Failed to delete tick:', err);
      alert('Failed to delete tick. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  if (loading) {
    return (
      <div className="my-ticks-page">
        <div className="loading">Loading your ticks...</div>
      </div>
    );
  }

  return (
    <div className="my-ticks-page">
      <div className="my-ticks-container">
        <div className="my-ticks-header">
          <h1>My Ticks</h1>
          <p className="subtitle">Your completed boulder problems</p>
        </div>

        {error && <div className="error-message">{error}</div>}

        {ticks.length === 0 ? (
          <div className="empty-state">
            <p>You haven't ticked any boulder problems yet.</p>
            <p>
              <Link to="/problems">Browse problems</Link> to start tracking your sends!
            </p>
          </div>
        ) : (
          <>
            {!statsLoading && statistics && (
              <div className="statistics-section">
                <h2>Your Climbing Statistics</h2>
                
                <div className="stats-grid">
                  {/* Main Stats */}
                  <div className="stat-card main-stat">
                    <div className="stat-value-large">{statistics.total_ticks}</div>
                    <div className="stat-label">Total Ascents</div>
                  </div>

                  {statistics.hardest_grade && (
                    <div className="stat-card main-stat">
                      <div className="stat-value-large grade-value">{statistics.hardest_grade}</div>
                      <div className="stat-label">Hardest Grade</div>
                    </div>
                  )}

                  {statistics.unique_crags > 0 && (
                    <div className="stat-card main-stat">
                      <div className="stat-value-large">{statistics.unique_crags}</div>
                      <div className="stat-label">Crags Visited</div>
                    </div>
                  )}

                  {statistics.unique_cities > 0 && (
                    <div className="stat-card main-stat">
                      <div className="stat-value-large">{statistics.unique_cities}</div>
                      <div className="stat-label">Cities Explored</div>
                    </div>
                  )}

                  {statistics.average_rating && (
                    <div className="stat-card main-stat">
                      <div className="stat-value-large">{statistics.average_rating.toFixed(1)}</div>
                      <div className="stat-label">Avg Rating ({statistics.rated_problems_count} rated)</div>
                    </div>
                  )}

                  {statistics.climbing_span_years && (
                    <div className="stat-card main-stat">
                      <div className="stat-value-large">{statistics.climbing_span_years}</div>
                      <div className="stat-label">Years Climbing</div>
                    </div>
                  )}

                  {statistics.avg_ticks_per_year && (
                    <div className="stat-card main-stat">
                      <div className="stat-value-large">{statistics.avg_ticks_per_year}</div>
                      <div className="stat-label">Avg Ticks/Year</div>
                    </div>
                  )}

                  {/* Activity Info */}
                  {statistics.first_send && (
                    <div className="stat-card">
                      <div className="stat-label-small">First Send</div>
                      <div className="stat-value-medium">{new Date(statistics.first_send).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                  )}

                  {statistics.latest_send && (
                    <div className="stat-card">
                      <div className="stat-label-small">Latest Send</div>
                      <div className="stat-value-medium">{new Date(statistics.latest_send).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                    </div>
                  )}

                  {statistics.most_climbed_crag && (
                    <div className="stat-card">
                      <div className="stat-label-small">Most Climbed Crag</div>
                      <div className="stat-value-medium">
                        <Link to={`/crags/${statistics.most_climbed_crag.id}`}>
                          {statistics.most_climbed_crag.name}
                        </Link>
                      </div>
                      <div className="stat-detail">{statistics.most_climbed_crag.tick_count} ascents</div>
                    </div>
                  )}

                  {statistics.most_climbed_city && (
                    <div className="stat-card">
                      <div className="stat-label-small">Most Climbed City</div>
                      <div className="stat-value-medium">{statistics.most_climbed_city.name}</div>
                      <div className="stat-detail">{statistics.most_climbed_city.tick_count} ascents</div>
                    </div>
                  )}

                  {statistics.most_active_year && (
                    <div className="stat-card">
                      <div className="stat-label-small">Most Active Year</div>
                      <div className="stat-value-medium">{statistics.most_active_year.year}</div>
                      <div className="stat-detail">{statistics.most_active_year.tick_count} ascents</div>
                    </div>
                  )}

                  {statistics.most_active_month && (
                    <div className="stat-card">
                      <div className="stat-label-small">Most Active Month</div>
                      <div className="stat-value-medium">{statistics.most_active_month.month_name}</div>
                      <div className="stat-detail">{statistics.most_active_month.tick_count} ascents</div>
                    </div>
                  )}
                </div>

                {/* Grade Distribution and Activity by Year - Compact Side by Side */}
                {(statistics.grade_distribution && Object.keys(statistics.grade_distribution).length > 0) ||
                (statistics.ticks_per_year && Object.keys(statistics.ticks_per_year).length > 0) ? (
                  <div className="compact-charts-container">
                    {/* Grade Distribution */}
                    {statistics.grade_distribution && Object.keys(statistics.grade_distribution).length > 0 && (
                      <div className="stat-group compact">
                        <h3>Grade Distribution</h3>
                        <div className="grade-distribution-compact">
                          {Object.entries(statistics.grade_distribution)
                            .filter(([_, count]) => count > 0)
                            .map(([grade, count]) => {
                              const maxCount = Math.max(...Object.values(statistics.grade_distribution).filter(c => c > 0));
                              const heightPercentage = (count / maxCount) * 100;
                              const percentage = (count / statistics.total_ticks) * 100;
                              return (
                                <div key={grade} className="grade-dist-item-compact" title={`${count} ascents (${percentage.toFixed(1)}%)`}>
                                  <div className="grade-dist-bar-container-vertical">
                                    <div 
                                      className="grade-dist-bar-vertical" 
                                      style={{ height: `${heightPercentage}%` }}
                                    />
                                  </div>
                                  <div className="grade-dist-label-compact">
                                    <span className="grade-dist-grade-compact">{grade}</span>
                                    <span className="grade-dist-count-compact">{count}</span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Activity by Year */}
                    {statistics.ticks_per_year && Object.keys(statistics.ticks_per_year).length > 0 && (
                      <div className="stat-group compact">
                        <h3>Activity by Year</h3>
                        <div className="year-activity-compact">
                          {Object.entries(statistics.ticks_per_year)
                            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                            .map(([year, count]) => {
                              const maxCount = Math.max(...Object.values(statistics.ticks_per_year));
                              const heightPercentage = (count / maxCount) * 100;
                              return (
                                <div key={year} className="year-activity-item-compact" title={`${count} ascents in ${year}`}>
                                  <div className="year-activity-bar-container-vertical">
                                    <div 
                                      className="year-activity-bar-vertical" 
                                      style={{ height: `${heightPercentage}%` }}
                                    />
                                  </div>
                                  <div className="year-activity-label-compact">
                                    <span className="year-activity-year-compact">{year}</span>
                                    <span className="year-activity-count-compact">{count}</span>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            <div className="ticks-list-header">
              <h2>All Your Ascents</h2>
            </div>

            <div className="ticks-list">
              {ticks.map((tick) => (
                <div key={tick.id} className="tick-item">
                  <div className="tick-main">
                    <div className="tick-problem">
                      <Link to={`/problems/${tick.problem.id}`} className="problem-name">
                        {tick.problem.name}
                      </Link>
                      <span className="problem-grade">{tick.problem.grade}</span>
                    </div>
                    <div className="tick-meta">
                      <span className="tick-date">{formatDate(tick.date)}</span>
                      {tick.problem.crag && (
                        <Link to={`/crags/${tick.problem.crag.id}`} className="tick-crag">
                          {tick.problem.crag.name}
                        </Link>
                      )}
                    </div>
                    {tick.notes && (
                      <div className="tick-notes">{tick.notes}</div>
                    )}
                  </div>
                  <div className="tick-actions">
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(tick.id)}
                      title="Delete tick"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MyTicks;
