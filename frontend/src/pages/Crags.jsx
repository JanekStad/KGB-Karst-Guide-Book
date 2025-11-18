import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cragsAPI } from '../services/api';
import './Crags.css';

const Crags = () => {
  const { isAuthenticated } = useAuth();
  const [crags, setCrags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchCrags();
  }, []);

  const fetchCrags = async () => {
    try {
      console.log('📡 Fetching crags...', { searchTerm });
      setLoading(true);
      const params = searchTerm ? { search: searchTerm } : {};
      const response = await cragsAPI.list(params);
      console.log('✅ Crags fetched successfully:', response.data);
      setCrags(response.data.results || response.data);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch crags:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        request: err.request,
      });
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Failed to load crags. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchCrags();
  };

  if (loading) {
    return (
      <div className="crags-page">
        <div className="loading">Loading crags...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="crags-page">
        <div className="error">
          <h3>Error loading crags</h3>
          <p>{error}</p>
          <button onClick={fetchCrags} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="crags-page">
      <div className="page-header">
        <div className="header-top">
          <h1>Crags</h1>
          {isAuthenticated && (
            <Link to="/crags/add" className="btn btn-primary">
              + Add Crag
            </Link>
          )}
        </div>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search crags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
      </div>

      <div className="crags-grid">
        {crags.length === 0 ? (
          <div className="empty-state">
            <p>No crags found. Be the first to add one!</p>
          </div>
        ) : (
          crags.map((crag) => (
            <Link
              key={crag.id}
              to={`/crags/${crag.id}`}
              className="crag-card"
            >
              <div className="crag-info">
                <h3>{crag.name}</h3>
                <p className="stats">
                  {crag.problem_count || 0} problem{(crag.problem_count || 0) !== 1 ? 's' : ''}
                </p>
                {crag.latitude && crag.longitude && (
                  <p className="coordinates">
                    📍 {crag.latitude}, {crag.longitude}
                  </p>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
};

export default Crags;

