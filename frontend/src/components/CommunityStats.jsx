import { useEffect, useState } from 'react';
import { ticksAPI } from '../services/api';
import './DashboardCard.css';
import './CommunityStats.css';

const CommunityStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await ticksAPI.getCommunityStats();
      setStats(response.data);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch community stats:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-card community-stats-card">
        <h3 className="card-title">STATISTICS</h3>
        <div className="card-loading">Loading statistics...</div>
      </div>
    );
  }

  if (error || !stats) {
    return null;
  }

  return (
    <div className="dashboard-card community-stats-card">
      <div className="card-header">
        <h3 className="card-title">STATISTICS</h3>
      </div>
      <div className="community-stats-table-container">
        <table className="community-stats-table">
          <tbody>
            <tr className="stats-row">
              <td className="stats-label">Problems</td>
              <td className="stats-value">{stats.total_problems || 0}</td>
            </tr>
            <tr className="stats-row">
              <td className="stats-label">Sends Logged</td>
              <td className="stats-value">{stats.total_ticks || 0}</td>
            </tr>
            <tr className="stats-row">
              <td className="stats-label">Active Climbers</td>
              <td className="stats-value">{stats.active_climbers || 0}</td>
            </tr>
            <tr className="stats-row">
              <td className="stats-label">Areas</td>
              <td className="stats-value">{stats.total_areas || 0}</td>
            </tr>
            {stats.recent_ticks_30d !== undefined && (
              <tr className="stats-row">
                <td className="stats-label">Recent (30d)</td>
                <td className="stats-value">{stats.recent_ticks_30d || 0}</td>
              </tr>
            )}
            {stats.most_ticked_problem && (
              <tr className="stats-row stats-row-highlight">
                <td className="stats-label">Most Ticked</td>
                <td className="stats-value">
                  {stats.most_ticked_problem.name} ({stats.most_ticked_problem.grade})
                  <span className="stats-tick-count"> • {stats.most_ticked_problem.tick_count}</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CommunityStats;

