import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cragsAPI, problemsAPI } from '../services/api';
import './AddProblem.css';

const AddProblem = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { cragId } = useParams(); // Optional: if coming from crag detail page
  const [crags, setCrags] = useState([]);
  const [walls, setWalls] = useState([]);
  const [formData, setFormData] = useState({
    crag: cragId || '',
    wall: '',
    name: '',
    grade: '',
    description: '',
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
    fetchCrags();
  }, []);

  useEffect(() => {
    if (formData.crag) {
      fetchWalls(formData.crag);
    } else {
      setWalls([]);
      setFormData(prev => ({ ...prev, wall: '' }));
    }
  }, [formData.crag]);

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
      setLoadingData(false);
    }
  };

  const fetchWalls = async (cragId) => {
    try {
      const response = await cragsAPI.getWalls(cragId);
      setWalls(response.data.results || response.data);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!formData.crag) {
      setError('Please select a crag');
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
        crag: parseInt(formData.crag),
        name: formData.name,
        grade: formData.grade,
        description: formData.description,
      };
      
      if (formData.wall) {
        payload.wall = parseInt(formData.wall);
      }

      const response = await problemsAPI.create(payload);
      console.log('✅ Problem created successfully:', response.data);
      navigate(`/problems/${response.data.id}`);
    } catch (err) {
      console.error('❌ Failed to create problem:', err);
      const errorMessage = err.response?.data?.crag?.[0] ||
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
        <p className="subtitle">Add a new climbing problem to a crag</p>

        <form onSubmit={handleSubmit} className="problem-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="crag">Crag *</label>
            <select
              id="crag"
              name="crag"
              value={formData.crag}
              onChange={handleChange}
              required
              disabled={!!cragId}
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
            <label htmlFor="wall">Wall/Sector (Optional)</label>
            <select
              id="wall"
              name="wall"
              value={formData.wall}
              onChange={handleChange}
              disabled={!formData.crag}
            >
              <option value="">No wall/sector</option>
              {walls.map((wall) => (
                <option key={wall.id} value={wall.id}>
                  {wall.name}
                </option>
              ))}
            </select>
            {formData.crag && walls.length === 0 && (
              <small>
                No walls in this crag. Walls are optional - you can add the problem without one.
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
              disabled={loading || !formData.crag || !formData.grade}
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
