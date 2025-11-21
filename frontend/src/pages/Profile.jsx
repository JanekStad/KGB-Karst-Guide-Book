import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ticksAPI, usersAPI } from '../services/api';
import './Profile.css';

const Profile = () => {
  const { isAuthenticated, user, loading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    bio: '',
    location: '',
    height: '',
    ape_index: '',
  });

  // Lezec import state
  const [lezecUsername, setLezecUsername] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);

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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (isAuthenticated && user) {
      fetchProfile();
    }
  }, [isAuthenticated, authLoading, user, navigate]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      // Try to get profile from /users/profiles/me/ first
      try {
        const profileResponse = await usersAPI.getMyProfile();
        const profileData = profileResponse.data || {};
        setProfile(profileData);
        setFormData({
          bio: profileData.bio || '',
          location: profileData.location || '',
          height: profileData.height || '',
          ape_index: profileData.ape_index || '',
        });
      } catch (profileErr) {
        // Fallback to getting from user endpoint
        const userResponse = await usersAPI.getProfile();
        const profileData = userResponse.data.profile || {};
        setProfile(profileData);
        setFormData({
          bio: profileData.bio || '',
          location: profileData.location || '',
          height: profileData.height || '',
          ape_index: profileData.ape_index || '',
        });
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      setError('Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const payload = {
        bio: formData.bio,
        location: formData.location,
        height: formData.height || null,
        ape_index: formData.ape_index ? parseFloat(formData.ape_index) : null,
      };

      await usersAPI.updateProfile(payload);
      setSuccess(true);
      await refreshUser();
      fetchProfile();
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update profile:', err);
      const errorMessage = err.response?.data?.detail ||
                          (err.response?.data && Object.values(err.response.data).flat().join(' ')) ||
                          err.message ||
                          'Failed to update profile. Please try again.';
      setError(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleLezecImport = async () => {
    if (!lezecUsername.trim()) {
      setError('Please enter your lezec.cz username');
      return;
    }

    setShowImportConfirm(true);
  };

  const confirmLezecImport = async () => {
    setImporting(true);
    setError(null);
    setImportResult(null);
    setShowImportConfirm(false);

    try {
      const response = await ticksAPI.importLezecDiary(lezecUsername.trim());
      setImportResult(response.data);
      
      if (response.data.success) {
        setLezecUsername(''); // Clear input on success
      } else {
        setError(response.data.message || 'Import failed.');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.message ||
                          err.message ||
                          'Failed to import diary. Please try again.';
      setError(errorMessage);
      setImportResult({
        success: false,
        message: errorMessage,
      });
    } finally {
      setImporting(false);
    }
  };

  const cancelLezecImport = () => {
    setShowImportConfirm(false);
  };

  if (authLoading || loading) {
    return (
      <div className="profile-page">
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <h1>My Profile</h1>
        <p className="profile-username">@{user?.username}</p>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">Profile updated successfully!</div>}

        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-section">
            <h2>Basic Information</h2>
            
            <div className="form-group">
              <label htmlFor="bio">Bio</label>
              <textarea
                id="bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                rows="4"
                placeholder="Tell us about yourself..."
                maxLength={500}
              />
              <small>{formData.bio.length}/500 characters</small>
            </div>

            <div className="form-group">
              <label htmlFor="location">Location</label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="e.g., Prague, Czech Republic"
                maxLength={100}
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Physical Stats</h2>
            <p className="section-description">
              Help improve statistics by sharing your height and ape index. This data is used to show height distribution on problem pages.
            </p>

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
              <label htmlFor="ape_index">Ape Index</label>
              <input
                type="number"
                id="ape_index"
                name="ape_index"
                value={formData.ape_index}
                onChange={handleChange}
                step="0.1"
                placeholder="e.g., 2.5 (wingspan - height in cm)"
              />
              <small>Ape index = wingspan - height (in cm). Positive means longer wingspan. Leave empty if unknown.</small>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

        {/* Lezec Import Section */}
        <div className="form-section lezec-import-section">
          <h2>Import from Lezec.cz</h2>
          <p className="section-description">
            Import your completed boulder problems (ticks) from your public lezec.cz diary. 
            Only boulders from Moravský Kras will be imported.
          </p>

          {importResult && (
            <div className={`import-result ${importResult.success ? 'success' : 'error'}`}>
              <h3>{importResult.success ? '✓ Import Completed' : '✗ Import Failed'}</h3>
              <p>{importResult.message}</p>
              {importResult.success && (
                <div className="import-stats">
                  <div className="stat-row">
                    <span>Matched:</span>
                    <strong>{importResult.matched || 0}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Created:</span>
                    <strong>{importResult.created || 0}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Already Existing:</span>
                    <strong>{importResult.existing || 0}</strong>
                  </div>
                  <div className="stat-row">
                    <span>Not Found:</span>
                    <strong>{importResult.not_found || 0}</strong>
                  </div>
                  {importResult.errors > 0 && (
                    <div className="stat-row error">
                      <span>Errors:</span>
                      <strong>{importResult.errors}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {showImportConfirm && (
            <div className="import-confirm-dialog">
              <h3>Confirm Import</h3>
              <p>
                Are you sure you want to import ticks from lezec.cz user <strong>{lezecUsername}</strong>?
              </p>
              <p className="confirm-note">
                This will import all boulder ticks from Moravský Kras found in the public diary.
                Ticks that already exist will be skipped.
              </p>
              <p className="confirm-note">
                Note: Your diary must be set to public on lezec.cz for this to work.
              </p>
              <div className="confirm-actions">
                <button 
                  onClick={confirmLezecImport} 
                  className="btn btn-primary"
                  disabled={importing}
                >
                  {importing ? 'Importing...' : 'Yes, Import'}
                </button>
                <button 
                  onClick={cancelLezecImport} 
                  className="btn btn-secondary"
                  disabled={importing}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!showImportConfirm && (
            <div className="lezec-import-form">
              <div className="form-group">
                <label htmlFor="lezec_username">Lezec.cz Username</label>
                <input
                  type="text"
                  id="lezec_username"
                  value={lezecUsername}
                  onChange={(e) => setLezecUsername(e.target.value)}
                  placeholder="e.g., Lucaa"
                  disabled={importing}
                />
                <small>Enter your lezec.cz username (your diary must be public)</small>
              </div>
              <button
                type="button"
                onClick={handleLezecImport}
                disabled={importing || !lezecUsername.trim()}
                className="btn btn-secondary"
              >
                {importing ? 'Importing...' : 'Import Ticks'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;

