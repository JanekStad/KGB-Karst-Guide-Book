import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { bouldersAPI } from '../services/api';
import './Boulders.css';

const Boulders = () => {
  const { isAuthenticated } = useAuth();
  const [boulders, setBoulders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchBoulders();
  }, []);

  const fetchBoulders = async () => {
    try {
      console.log('📡 Fetching boulders...', { searchTerm });
      setLoading(true);
      const params = searchTerm ? { search: searchTerm } : {};
      const response = await bouldersAPI.list(params);
      console.log('✅ Boulders fetched successfully:', response.data);
      setBoulders(response.data.results || response.data);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch boulders:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        request: err.request,
      });
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Failed to load boulders. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchBoulders();
  };

  if (loading) {
    return (
      <div className="boulders-page">
        <div className="loading">Loading boulders...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="boulders-page">
        <div className="error">
          <h3>Error loading boulders</h3>
          <p>{error}</p>
          <button onClick={fetchBoulders} className="btn btn-primary">
            Retry
          </button>
          <details style={{ marginTop: '1rem', padding: '1rem', background: '#f8f9fa', borderRadius: '4px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600' }}>Debug Info</summary>
            <pre style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              {JSON.stringify({ error, searchTerm, loading }, null, 2)}
            </pre>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div className="boulders-page">
      <div className="page-header">
        <div className="header-top">
          <h1>Boulders</h1>
        </div>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Search boulders..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
      </div>

      <div className="boulders-grid">
        {boulders.length === 0 ? (
          <div className="empty-state">
            <p>No boulders found. Be the first to add one!</p>
          </div>
        ) : (
          boulders.map((boulder) => (
            <Link
              key={boulder.id}
              to={`/boulders/${boulder.id}`}
              className="boulder-card"
            >
              <div className="boulder-image">
                {boulder.primary_image ? (
                  <img src={boulder.primary_image} alt={boulder.name} />
                ) : (
                  <div className="placeholder-image">📷</div>
                )}
              </div>
              <div className="boulder-info">
                <h3>{boulder.name}</h3>
                {boulder.crag_name && (
                  <p className="crag-name">📍 {boulder.crag_name}</p>
                )}
                <p className="problem-count">
                  {boulder.problem_count || 0} problem{boulder.problem_count !== 1 ? 's' : ''}
                </p>
                {boulder.display_latitude && boulder.display_longitude && (
                  <p className="coordinates">
                    📍 {boulder.display_latitude}, {boulder.display_longitude}
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

export default Boulders;

