import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ticksAPI } from '../services/api';
import './DashboardCard.css';
import './RecentSendsCard.css';

const RecentSendsCard = () => {
  const { isAuthenticated } = useAuth();
  const [recentTicks, setRecentTicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRecentTicks();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated]);

  const fetchRecentTicks = async () => {
    try {
      setLoading(true);
      const response = await ticksAPI.list();
      const ticks = response.data.results || response.data;
      // Sort by date (most recent first) and take first 10
      const sortedTicks = ticks
        .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
        .slice(0, 10);
      setRecentTicks(sortedTicks);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch recent ticks:', err);
      setError('Failed to load recent sends');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="dashboard-card recent-sends-card">
        <h3 className="card-title">RECENT SENDS</h3>
        <div className="card-empty">
          <p>Sign in to see your recent sends</p>
          <Link to="/login" className="card-link">Login</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="dashboard-card recent-sends-card">
        <h3 className="card-title">RECENT SENDS</h3>
        <div className="card-loading">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-card recent-sends-card">
        <h3 className="card-title">RECENT SENDS</h3>
        <div className="card-error">
          <p>{error}</p>
          <button onClick={fetchRecentTicks} className="card-retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  if (recentTicks.length === 0) {
    return (
      <div className="dashboard-card recent-sends-card">
        <h3 className="card-title">RECENT SENDS</h3>
        <div className="card-empty">
          <p>No sends yet. Start climbing!</p>
          <Link to="/explore" className="card-link">Explore Problems</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card recent-sends-card">
      <div className="card-header">
        <h3 className="card-title">RECENT SENDS</h3>
        <Link to="/profile" className="card-view-all">View All →</Link>
      </div>
      <div className="recent-sends-scroll">
        {recentTicks.map((tick) => {
          const problem = tick.problem || {};
          const problemId = problem.id || tick.problem;
          
          return (
            <Link
              key={tick.id}
              to={`/problems/${problemId}`}
              className="recent-send-item"
            >
              <p className="recent-send-name">
                {problem.name || 'Unknown Problem'}
              </p>
              {problem.grade && (
                <span className="recent-send-grade">
                  {problem.grade}
                </span>
              )}
              {tick.date && (
                <span className="recent-send-date">
                  {new Date(tick.date).toLocaleDateString('cs-CZ', {
                    day: 'numeric',
                    month: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default RecentSendsCard;

