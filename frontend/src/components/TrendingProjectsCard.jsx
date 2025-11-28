import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { problemsAPI } from '../services/api';
import './DashboardCard.css';
import './TrendingProjectsCard.css';

const TrendingProjectsCard = () => {
  const [trendingProblems, setTrendingProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTrendingProblems();
  }, []);

  const fetchTrendingProblems = async () => {
    try {
      setLoading(true);
      // Fetch problems and sort by tick count
      const response = await problemsAPI.list({ page_size: 50 });
      const problems = response.data.results || response.data;
      
      // Sort by tick_count (descending) and take top 10
      const sortedProblems = problems
        .sort((a, b) => (b.tick_count || 0) - (a.tick_count || 0))
        .slice(0, 10);
      
      setTrendingProblems(sortedProblems);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch trending problems:', err);
      setError('Failed to load trending projects');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-card trending-projects-card">
        <h3 className="card-title">TRENDING PROJECTS</h3>
        <div className="card-loading">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-card trending-projects-card">
        <h3 className="card-title">TRENDING PROJECTS</h3>
        <div className="card-error">
          <p>{error}</p>
          <button onClick={fetchTrendingProblems} className="card-retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  if (trendingProblems.length === 0) {
    return (
      <div className="dashboard-card trending-projects-card">
        <h3 className="card-title">TRENDING PROJECTS</h3>
        <div className="card-empty">
          <p>No trending projects yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-card trending-projects-card">
      <div className="card-header">
        <h3 className="card-title">TRENDING PROJECTS</h3>
        <Link to="/problems" className="card-view-all">View All →</Link>
      </div>
      <table className="trending-table">
        <thead>
          <tr>
            <th className="table-route">Route</th>
            <th className="table-grade">Grade</th>
            <th className="table-ticks">Ticks</th>
          </tr>
        </thead>
        <tbody>
          {trendingProblems.map((problem) => (
            <tr key={problem.id} className="trending-row">
              <td className="table-route">
                <Link to={`/problems/${problem.id}`} className="trending-link">
                  {problem.name}
                </Link>
              </td>
              <td className="table-grade">{problem.grade || '-'}</td>
              <td className="table-ticks">{problem.tick_count || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TrendingProjectsCard;

