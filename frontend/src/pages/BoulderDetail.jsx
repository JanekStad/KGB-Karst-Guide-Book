import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { bouldersAPI } from '../services/api';
import './BoulderDetail.css';

const BoulderDetail = () => {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const [boulder, setBoulder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBoulder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchBoulder = async () => {
    try {
      console.log('📡 Fetching boulder details for ID:', id);
      setLoading(true);
      const response = await bouldersAPI.get(id);
      console.log('✅ Boulder fetched successfully:', response.data);
      setBoulder(response.data);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch boulder:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        request: err.request,
        status: err.response?.status,
      });
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Failed to load boulder details.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="boulder-detail-page">
        <div className="loading">Loading boulder details...</div>
      </div>
    );
  }

  if (error || !boulder) {
    return (
      <div className="boulder-detail-page">
        <div className="error">{error || 'Boulder not found'}</div>
      </div>
    );
  }

  return (
    <div className="boulder-detail-page">
      <Link to="/boulders" className="back-link">← Back to Boulders</Link>
      
      <div className="boulder-header">
        <h1>{boulder.name}</h1>
        {boulder.crag && (
          <p className="crag-link">
            Crag: <Link to={`/crags/${boulder.crag.id}`}>{boulder.crag.name}</Link>
          </p>
        )}
        {boulder.description && <p className="description">{boulder.description}</p>}
        {(boulder.display_latitude && boulder.display_longitude) && (
          <p className="coordinates">
            📍 Coordinates: {boulder.display_latitude}, {boulder.display_longitude}
          </p>
        )}
      </div>

      {boulder.images && boulder.images.length > 0 && (
        <div className="images-section">
          <h2>Images</h2>
          <div className="images-grid">
            {boulder.images.map((image) => (
              <div key={image.id} className="image-item">
                <img src={image.image} alt={image.caption || boulder.name} />
                {image.caption && <p className="image-caption">{image.caption}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="problems-section">
        <div className="problems-header">
          <h2>Problems ({boulder.problems?.length || 0})</h2>
          {isAuthenticated && (
            <Link to={`/boulders/${boulder.id}/problems/add`} className="btn btn-primary">
              + Add Problem
            </Link>
          )}
        </div>
        {boulder.problems && boulder.problems.length > 0 ? (
          <div className="problems-list">
            {boulder.problems.map((problem) => (
              <Link
                key={problem.id}
                to={`/problems/${problem.id}`}
                className="problem-card"
              >
                <div className="problem-grade">{problem.grade}</div>
                <div className="problem-info">
                  <h3>{problem.name}</h3>
                  {problem.description && (
                    <p className="problem-description">{problem.description}</p>
                  )}
                  {problem.tick_count !== undefined && (
                    <p className="tick-count">
                      {problem.tick_count} tick{problem.tick_count !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="no-problems">No problems added yet.</p>
        )}
      </div>
    </div>
  );
};

export default BoulderDetail;

