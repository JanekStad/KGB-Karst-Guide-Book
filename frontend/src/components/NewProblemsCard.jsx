import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { problemsAPI } from '../services/api';
import './DashboardCard.css';
import './NewProblemsCard.css';

const NewProblemsCard = () => {
  const [newProblems, setNewProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchNewProblems();
  }, []);

  const fetchNewProblems = async () => {
    try {
      setLoading(true);
      // Fetch newest problems, ordered by creation date descending
      const response = await problemsAPI.list({ 
        ordering: '-created_at',
        page_size: 10 
      });
      const problems = response.data.results || response.data;
      setNewProblems(Array.isArray(problems) ? problems.slice(0, 10) : []);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch new problems:', err);
      setError('Failed to load new problems');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-card new-problems-card">
        <h3 className="card-title">NEW PROBLEMS</h3>
        <div className="card-loading">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-card new-problems-card">
        <h3 className="card-title">NEW PROBLEMS</h3>
        <div className="card-error">
          <p>{error}</p>
          <button onClick={fetchNewProblems} className="card-retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  if (newProblems.length === 0) {
    return (
      <div className="dashboard-card new-problems-card">
        <div className="card-header">
          <h3 className="card-title">NEW PROBLEMS</h3>
        </div>
        <div className="card-empty">
          <p>No new problems yet.</p>
          <Link to="/problems/add" className="card-link">Add Problem</Link>
        </div>
      </div>
    );
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
    <div className="dashboard-card new-problems-card">
      <div className="card-header">
        <h3 className="card-title">NEW PROBLEMS</h3>
        <Link to="/problems" className="card-view-all">View All →</Link>
      </div>
      <div className="new-problems-table-container">
        <table className="new-problems-table">
          <thead>
            <tr>
              <th>Problem</th>
              <th>Grade</th>
              <th>Area</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {newProblems.map((problem) => {
              const problemName = problem.name || 'Unknown Problem';
              const grade = problem.grade || '';
              const areaName = problem.area_name || problem.area?.name || '-';
              const addedDate = formatDate(problem.created_at);
              
              return (
                <tr key={problem.id} className="new-problem-row">
                  <td>
                    <Link to={`/problems/${problem.id}`} className="new-problem-link">
                      {problemName}
                    </Link>
                  </td>
                  <td className="new-problem-grade">{grade || '-'}</td>
                  <td className="new-problem-area">{areaName}</td>
                  <td className="new-problem-date">{addedDate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default NewProblemsCard;

