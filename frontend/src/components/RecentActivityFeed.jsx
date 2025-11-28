import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ticksAPI } from '../services/api';
import './DashboardCard.css';
import './RecentActivityFeed.css';

const RecentActivityFeed = ({ limit = 5 }) => {
  const [recentTicks, setRecentTicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRecentTicks();
  }, [limit]);

  const fetchRecentTicks = async () => {
    try {
      setLoading(true);
      const response = await ticksAPI.getRecent(limit);
      setRecentTicks(response.data || []);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch recent activity:', err);
      setError('Failed to load recent activity');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-card recent-activity-card">
        <h3 className="card-title">RECENT ACTIVITY</h3>
        <div className="card-loading">Loading recent activity...</div>
      </div>
    );
  }

  if (error || recentTicks.length === 0) {
    return null; // Don't show anything if there's an error or no data
  }

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('cs-CZ', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="dashboard-card recent-activity-card">
      <div className="card-header">
        <h3 className="card-title">RECENT ACTIVITY</h3>
      </div>
      <div className="recent-activity-table-container">
        <table className="recent-activity-table">
          <thead>
            <tr>
              <th>Climber</th>
              <th>Problem</th>
              <th>Grade</th>
              <th>Area</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {recentTicks.map((tick) => {
              const username = tick.user?.username || 'Someone';
              const problemName = tick.problem?.name || 'Unknown Problem';
              const problemId = tick.problem?.id || tick.problem;
              const grade = tick.problem?.grade || tick.tick_grade || '';
              const areaName = tick.problem?.area_name || '';
              const date = formatDate(tick.date || tick.created_at);
              
              return (
                <tr key={tick.id} className="activity-row">
                  <td className="activity-username">{username}</td>
                  <td>
                    <Link to={`/problems/${problemId}`} className="activity-problem">
                      {problemName}
                    </Link>
                  </td>
                  <td className="activity-grade">{grade || '-'}</td>
                  <td className="activity-area">{areaName || '-'}</td>
                  <td className="activity-date">{date}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentActivityFeed;

