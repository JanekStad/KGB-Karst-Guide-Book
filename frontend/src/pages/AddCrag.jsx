import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { areasAPI } from '../services/api';
import './AddCrag.css';

const AddCrag = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    latitude: '',
    longitude: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

    const lat = parseFloat(formData.latitude);
    const lon = parseFloat(formData.longitude);

    if (isNaN(lat) || isNaN(lon)) {
      setError('Please enter valid numeric coordinates');
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

    try {
      console.log('📡 Creating area...', formData);
      const response = await areasAPI.create({
        name: formData.name,
        description: formData.description,
        latitude: lat.toString(),
        longitude: lon.toString(),
      });
      console.log('✅ Area created successfully:', response.data);
      navigate(`/areas/${response.data.id}`);
    } catch (err) {
      console.error('❌ Failed to create area:', err);
      const errorMessage = err.response?.data?.name?.[0] ||
                          err.response?.data?.latitude?.[0] ||
                          err.response?.data?.longitude?.[0] ||
                          err.response?.data?.detail ||
                          err.message ||
                          'Failed to create area. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-crag-page">
      <div className="add-crag-container">
        <h1>Add New Area</h1>
        <p className="subtitle">Add a new climbing area (e.g., Holstejn, Sloup)</p>

        <form onSubmit={handleSubmit} className="crag-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="name">Area Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., Smith Rock"
              autoFocus
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
              placeholder="Describe the crag, location, approach, etc."
            />
          </div>

          <div className="coordinates-group">
            <div className="form-group">
              <label htmlFor="latitude">Latitude *</label>
              <input
                type="number"
                id="latitude"
                name="latitude"
                value={formData.latitude}
                onChange={handleChange}
                required
                step="any"
                min="-90"
                max="90"
                placeholder="e.g., 45.123456"
              />
              <small>Between -90 and 90</small>
            </div>

            <div className="form-group">
              <label htmlFor="longitude">Longitude *</label>
              <input
                type="number"
                id="longitude"
                name="longitude"
                value={formData.longitude}
                onChange={handleChange}
                required
                step="any"
                min="-180"
                max="180"
                placeholder="e.g., -123.456789"
              />
              <small>Between -180 and 180</small>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => navigate('/areas')}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Creating...' : 'Create Area'}
            </button>
          </div>
        </form>

        <div className="help-text">
          <h3>💡 Tips</h3>
          <ul>
            <li>Get coordinates from Google Maps by right-clicking on a location</li>
            <li>Areas appear as points on the map in the mobile app</li>
            <li>After creating an area, you can add sectors and problems to it</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default AddCrag;

