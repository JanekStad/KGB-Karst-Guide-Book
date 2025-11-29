import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StarRating from '../components/StarRating';
import { useAuth } from '../contexts/AuthContext';
import { areasAPI, problemsAPI } from '../services/api';
import './AddProblem.css';

const AddProblem = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { areaId, cragId } = useParams(); // Optional: if coming from area detail page (cragId for backward compatibility)
  const [areas, setAreas] = useState([]);
  const [walls, setWalls] = useState([]);
  const [formData, setFormData] = useState({
    area: areaId || cragId || '',
    wall: '',
    name: '',
    grade: '',
    description: '',
    rating: null,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const GRADE_CHOICES = [
    '3', '3+', '4', '4+', '5', '5+',
    '6A', '6A+', '6B', '6B+', '6C', '6C+',
    '7A', '7A+', '7B', '7B+', '7C', '7C+',
    '8A', '8A+', '8B', '8B+', '8C', '8C+',
    '9A',
  ];

  useEffect(() => {
    fetchAreas();
  }, []);

  useEffect(() => {
    if (formData.area) {
      fetchWalls(formData.area);
    } else {
      setWalls([]);
      setFormData(prev => ({ ...prev, wall: '' }));
    }
  }, [formData.area]);

  const fetchAreas = async () => {
    try {
      const response = await areasAPI.list();
      setAreas(response.data.results || response.data);
      if (areaId || cragId) {
        setFormData(prev => ({ ...prev, area: areaId || cragId }));
      }
    } catch (err) {
      console.error('Failed to fetch areas:', err);
      setError('Failed to load areas. Please try again.');
    } finally {
      setLoadingData(false);
    }
  };

  const fetchWalls = async (areaId) => {
    try {
      // Note: Walls belong to sectors, not areas directly. This might need backend support.
      // For now, we'll keep this as a placeholder
      const response = await areasAPI.getSectors(areaId);
      // This would need to be updated when backend provides wall endpoints per area
      setWalls([]);
    } catch (err) {
      console.error('Failed to fetch walls:', err);
      setWalls([]);
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

  const handleRatingChange = (rating) => {
    setFormData({
      ...formData,
      rating: rating,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.area) {
      setError('Please select an area');
      setLoading(false);
      return;
    }

    if (!formData.grade) {
      setError('Please select a grade');
      setLoading(false);
      return;
    }

    try {
      console.log('📡 Creating problem...', formData);
      const payload = {
        area: parseInt(formData.area),
        name: formData.name,
        grade: formData.grade,
        description: formData.description,
      };
      
      if (formData.wall) {
        payload.wall = parseInt(formData.wall);
      }

      if (formData.rating) {
        payload.rating = parseFloat(formData.rating);
      }

      const response = await problemsAPI.create(payload);
      console.log('✅ Problem created successfully:', response.data);
      navigate(`/problems/${response.data.id}`);
    } catch (err) {
      console.error('❌ Failed to create problem:', err);
      const errorMessage = err.response?.data?.area?.[0] ||
                          err.response?.data?.name?.[0] ||
                          err.response?.data?.grade?.[0] ||
                          err.response?.data?.detail ||
                          err.message ||
                          'Failed to create problem. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="add-problem-page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="add-problem-page">
      <div className="add-problem-container">
        <h1>Add Boulder Problem</h1>
        <p className="subtitle">Add a new climbing problem to an area</p>

        <form onSubmit={handleSubmit} className="problem-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="area">Area *</label>
            <select
              id="area"
              name="area"
              value={formData.area}
              onChange={handleChange}
              required
              disabled={!!(areaId || cragId)}
            >
              <option value="">Select an area...</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
            {areas.length === 0 && (
              <small>
                No areas available. <a href="/areas/add">Create an area first</a>
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="wall">Wall/Sector (Optional)</label>
            <select
              id="wall"
              name="wall"
              value={formData.wall}
              onChange={handleChange}
              disabled={!formData.area}
            >
              <option value="">No wall/sector</option>
              {walls.map((wall) => (
                <option key={wall.id} value={wall.id}>
                  {wall.name}
                </option>
              ))}
            </select>
            {formData.area && walls.length === 0 && (
              <small>
                No walls in this area. Walls are optional - you can add the problem without one.
              </small>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="name">Problem Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., The Classic"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="grade">Grade *</label>
            <select
              id="grade"
              name="grade"
              value={formData.grade}
              onChange={handleChange}
              required
            >
              <option value="">Select a grade...</option>
              {GRADE_CHOICES.map((grade) => (
                <option key={grade} value={grade}>
                  {grade}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              placeholder="Describe the problem, beta, holds, etc."
            />
          </div>

          <div className="form-group">
            <label htmlFor="rating">Rating (Optional)</label>
            <StarRating
              rating={formData.rating || 0}
              onChange={handleRatingChange}
              editable={true}
              size="medium"
            />
            <small>Rate this problem from 1 to 5 stars</small>
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
              disabled={loading || !formData.area || !formData.grade}
              className="btn btn-primary"
            >
              {loading ? 'Creating...' : 'Create Problem'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProblem;
