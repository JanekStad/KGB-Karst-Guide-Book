import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    password_confirm: '',
    first_name: '',
    last_name: '',
    height: '',
    ape_index: '',
  });

  const HEIGHT_CHOICES = [
    { value: '', label: 'Select height (optional)' },
    { value: '<150', label: '<150 cm' },
    { value: '150-155', label: '150-155 cm' },
    { value: '155-160', label: '155-160 cm' },
    { value: '160-165', label: '160-165 cm' },
    { value: '165-170', label: '165-170 cm' },
    { value: '170-175', label: '170-175 cm' },
    { value: '175-180', label: '175-180 cm' },
    { value: '180-185', label: '180-185 cm' },
    { value: '185-190', label: '185-190 cm' },
    { value: '190-195', label: '190-195 cm' },
    { value: '>195', label: '>195 cm' },
  ];
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.password_confirm) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const result = await register(formData);
      if (result.success) {
        // If token is returned, auto-login
        if (result.data?.token) {
          localStorage.setItem('token', result.data.token);
          navigate('/');
          window.location.reload();
        } else {
          navigate('/login');
          alert('Registration successful! Please login.');
        }
      } else {
        const errorData = result.error;
        if (typeof errorData === 'object') {
          const errorMessages = Object.values(errorData).flat();
          setError(errorMessages[0] || 'Registration failed. Please try again.');
        } else {
          setError(errorData || 'Registration failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('Failed to register. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-container">
        <h1>Register</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label htmlFor="username">Username *</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name">First Name</label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label htmlFor="last_name">Last Name</label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="password">Password *</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
            />
            <small>Must be at least 8 characters</small>
          </div>
          <div className="form-group">
            <label htmlFor="password_confirm">Confirm Password *</label>
            <input
              type="password"
              id="password_confirm"
              name="password_confirm"
              value={formData.password_confirm}
              onChange={handleChange}
              required
            />
          </div>
          
          <div className="form-section-divider">
            <h3>Physical Stats (Optional)</h3>
            <p className="section-description">Help improve statistics by sharing your height and ape index</p>
          </div>
          
          <div className="form-group">
            <label htmlFor="height">Height</label>
            <select
              id="height"
              name="height"
              value={formData.height}
              onChange={handleChange}
            >
              {HEIGHT_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
            <small>Your height helps us show height distribution statistics</small>
          </div>
          
          <div className="form-group">
            <label htmlFor="ape_index">Ape Index (Optional)</label>
            <input
              type="number"
              id="ape_index"
              name="ape_index"
              value={formData.ape_index}
              onChange={handleChange}
              step="0.1"
              placeholder="e.g., 2.5 (wingspan - height in cm)"
            />
            <small>Ape index = wingspan - height (in cm). Positive means longer wingspan.</small>
          </div>
          
          <button type="submit" disabled={loading} className="btn btn-primary">
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        <p className="auth-link">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;

