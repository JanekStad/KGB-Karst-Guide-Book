import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { bouldersAPI, cragsAPI } from '../services/api';
import './AddBoulder.css';

const AddBoulder = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { cragId } = useParams(); // Optional: if coming from crag detail page
  const [crags, setCrags] = useState([]);
  const [formData, setFormData] = useState({
    crag: cragId || '',
    name: '',
    description: '',
    latitude: '',
    longitude: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingCrags, setLoadingCrags] = useState(true);

  useEffect(() => {
    fetchCrags();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCrags = async () => {
    try {
      const response = await cragsAPI.list();
      setCrags(response.data.results || response.data);
      if (cragId) {
        setFormData(prev => ({ ...prev, crag: cragId }));
      }
    } catch (err) {
      console.error('Failed to fetch crags:', err);
      setError('Failed to load crags. Please try again.');
    } finally {
      setLoadingCrags(false);
    }
  };

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.crag) {
      setError('Please select a crag');
      setLoading(false);
      return;
    }

    // Coordinates are optional - validate only if provided
    let lat = null;
    let lon = null;
    
    if (formData.latitude || formData.longitude) {
      lat = parseFloat(formData.latitude);
      lon = parseFloat(formData.longitude);

      if (isNaN(lat) || isNaN(lon)) {
        setError('Please enter valid numeric coordinates or leave both blank');
        setLoading(false);
        return;
      }

      if (lat < -90 || lat > 90) {
        setError('Latitude must be between -90 and 90');
        setLoading(false);
        return;
      }

      if (lon < -180 || lon > 180) {
        setError('Longitude must be between -180 and 180');
        setLoading(false);
        return;
      }
    }

    try {
      console.log('📡 Creating boulder...', formData);
      const payload = {
        crag: parseInt(formData.crag),
        name: formData.name,
        description: formData.description,
      };
      
      if (lat !== null && lon !== null) {
        payload.latitude = lat.toString();
        payload.longitude = lon.toString();
      }

      const response = await bouldersAPI.create(payload);
      console.log('✅ Boulder created successfully:', response.data);
      navigate(`/boulders/${response.data.id}`);
    } catch (err) {
      console.error('❌ Failed to create boulder:', err);
      const errorMessage = err.response?.data?.crag?.[0] ||
                          err.response?.data?.name?.[0] ||
                          err.response?.data?.detail ||
                          err.message ||
                          'Failed to create boulder. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loadingCrags) {
    return (
      <div className="add-boulder-page">
        <div className="loading">Loading crags...</div>
      </div>
    );
  }

  return (
    <div className="add-boulder-page">
      <div className="add-boulder-container">
        <h1>Add New Boulder</h1>
        <p className="subtitle">Add a boulder to a crag</p>

        <form onSubmit={handleSubmit} className="boulder-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="crag">Crag *</label>
            <select
              id="crag"
              name="crag"
              value={formData.crag}
              onChange={handleChange}
              required
            >
              <option value="">Select a crag...</option>
              {crags.map((crag) => (
                <option key={crag.id} value={crag.id}>
                  {crag.name}
                </option>
              ))}
            </select>
            {crags.length === 0 && (
              <small>
                No crags available. <a href="/crags/add">Create a crag first</a>
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="name">Boulder Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., The Big Boulder"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              placeholder="Describe the boulder..."
            />
          </div>

          <div className="coordinates-group">
            <div className="form-group">
              <label htmlFor="latitude">Latitude (Optional)</label>
              <input
                type="number"
                id="latitude"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                step="any"
                min="-90"
                max="90"
                placeholder="e.g., 45.123456"
              />
              <small>Boulder-specific coordinates (uses crag coordinates if not set)</small>
            </div>

            <div className="form-group">
              <label htmlFor="longitude">Longitude (Optional)</label>
              <input
                type="number"
                id="longitude"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                step="any"
                min="-180"
                max="180"
                placeholder="e.g., -123.456789"
              />
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || crags.length === 0}
              className="btn btn-primary"
            >
              {loading ? 'Creating...' : 'Create Boulder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBoulder;
