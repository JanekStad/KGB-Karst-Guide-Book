import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StarRating from '../components/StarRating';
import { useAuth } from '../contexts/AuthContext';
import { listsAPI, ticksAPI, usersAPI } from '../services/api';
import './MyTicks.css';
import './Profile.css';

const GRADE_CHOICES = ['3', '3+', '4', '4+', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+', '7A', '7A+', '7B', '7B+', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A', '9A+'];
const STYLE_CHOICES = ['send', 'flash', 'solo'];

const getTickStyle = (tick) => {
  if (tick.notes?.toLowerCase().includes('style:')) {
    const styleMatch = tick.notes.toLowerCase().match(/style:\s*(\w+)/);
    if (styleMatch) {
      const style = styleMatch[1].toLowerCase();
      if (STYLE_CHOICES.includes(style) || style === 'redpoint') {
        return style === 'redpoint' ? 'send' : style;
      }
    }
  }
  return 'send';
};

const getInitials = (name) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const Profile = () => {
  const { isAuthenticated, user, loading: authLoading, refreshUser } = useAuth();
  const navigate = useNavigate();
  
  // Profile state
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLezecImportModal, setShowLezecImportModal] = useState(false);
  
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

  // Ticks state
  const [ticks, setTicks] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [listsLoading, setListsLoading] = useState(true);
  const [editingTick, setEditingTick] = useState(null);
  const [showTickEditModal, setShowTickEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState('ticks');
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [styleFilter, setStyleFilter] = useState('all');
  const [showGradeDropdown, setShowGradeDropdown] = useState(false);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const gradeFilterRef = useRef(null);
  const styleFilterRef = useRef(null);
  const [tickFormData, setTickFormData] = useState({
    date: '',
    notes: '',
    tick_grade: '',
    suggested_grade: '',
    rating: null,
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

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (isAuthenticated && user) {
      fetchProfile();
      fetchTicks();
      fetchStatistics();
      fetchLists();
    }
  }, [isAuthenticated, authLoading, user, navigate]);

  const fetchProfile = async () => {
    try {
      setProfileLoading(true);
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
      setProfileLoading(false);
    }
  };

  const fetchTicks = async () => {
    try {
      setLoading(true);
      const response = await ticksAPI.list();
      setTicks(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch ticks:', err);
      setError('Failed to load your ticks. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      setStatsLoading(true);
      const response = await ticksAPI.getStatistics();
      setStatistics(response.data);
    } catch (err) {
      console.error('Failed to fetch statistics:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchLists = async () => {
    try {
      setListsLoading(true);
      const response = await listsAPI.list();
      // Handle both paginated (response.data.results) and direct array responses
      const listsData = response.data?.results || response.data;
      setLists(Array.isArray(listsData) ? listsData : []);
    } catch (err) {
      console.error('Failed to fetch lists:', err);
      setLists([]); // Ensure lists is always an array
    } finally {
      setListsLoading(false);
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
      setShowEditModal(false);
      
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
        setLezecUsername('');
        fetchTicks();
        fetchStatistics();
        // Auto-close modal after successful import (after a delay to show results)
        setTimeout(() => {
          setShowLezecImportModal(false);
          setImportResult(null);
        }, 3000);
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
    setLezecUsername('');
  };

  const handleEdit = (tick) => {
    setEditingTick(tick);
    setTickFormData({
      date: tick.date || new Date().toISOString().split('T')[0],
      notes: tick.notes || '',
      tick_grade: tick.tick_grade || '',
      suggested_grade: tick.suggested_grade || '',
      rating: tick.rating || null,
    });
    setShowTickEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingTick) return;

    try {
      const payload = {
        date: tickFormData.date,
        notes: tickFormData.notes,
        tick_grade: tickFormData.tick_grade || null,
        suggested_grade: tickFormData.suggested_grade || null,
      };
      if (tickFormData.rating) {
        payload.rating = parseFloat(tickFormData.rating);
      }

      await ticksAPI.patch(editingTick.id, payload);
      setShowTickEditModal(false);
      setEditingTick(null);
      fetchTicks();
      fetchStatistics();
    } catch (err) {
      console.error('Failed to update tick:', err);
      alert('Failed to update tick. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric'
    });
  };

  const formatMemberSince = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.getFullYear();
  };

  const availableGrades = useMemo(() => {
    const grades = new Set();
    const counts = {};
    ticks.forEach(tick => {
      const grade = tick.problem?.grade;
      if (grade) {
        grades.add(grade);
        counts[grade] = (counts[grade] || 0) + 1;
      }
    });
    const sortedGrades = GRADE_CHOICES.filter(grade => grades.has(grade));
    return { grades: sortedGrades, counts };
  }, [ticks]);

  const filteredTicks = useMemo(() => {
    return ticks.filter(tick => {
      const matchesSearch = !searchQuery || 
        tick.problem?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tick.problem?.crag && tick.problem.crag.name?.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const effectiveGrade = tick.tick_grade || tick.problem?.grade;
      const matchesGrade = gradeFilter === 'all' || effectiveGrade === gradeFilter;
      
      const tickStyle = getTickStyle(tick);
      const matchesStyle = styleFilter === 'all' || tickStyle === styleFilter;
      
      return matchesSearch && matchesGrade && matchesStyle;
    });
  }, [ticks, searchQuery, gradeFilter, styleFilter]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (gradeFilterRef.current && !gradeFilterRef.current.contains(event.target)) {
        setShowGradeDropdown(false);
      }
      if (styleFilterRef.current && !styleFilterRef.current.contains(event.target)) {
        setShowStyleDropdown(false);
      }
    };

    if (showGradeDropdown || showStyleDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showGradeDropdown, showStyleDropdown]);

  const totalPages = Math.ceil(filteredTicks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTicks = filteredTicks.slice(startIndex, startIndex + itemsPerPage);

  const totalSends = statistics?.total_ticks || ticks.length;
  const maxGrade = statistics?.hardest_grade || '-';
  const activeProjects = Array.isArray(lists) ? lists.length : 0;
  const firstAscents = statistics?.first_ascents || 0;
  const daysOut = statistics?.unique_days || 0;

  if (authLoading || (profileLoading && loading)) {
    return (
      <div className="profile-page">
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="profile-page dashboard-layout">
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">Profile updated successfully!</div>}

      <div className="dashboard-container">
        {/* Left Sidebar - Profile Card & Lists */}
        <aside className="profile-sidebar-left">
          {/* Profile Card */}
          <div className="profile-card">
            <div className="profile-avatar-container">
              <div className="profile-avatar">
                {user?.profile?.avatar ? (
                  <img src={user.profile.avatar} alt={user.username} />
                ) : (
                  <span>{getInitials(user?.username || 'U')}</span>
                )}
              </div>
            </div>
            <h2 className="profile-name">{user?.username || 'User'}</h2>
            {profile?.location && (
              <div className="profile-location">
                <span className="material-symbols-outlined">location_on</span>
                <span>{profile.location}</span>
              </div>
            )}
            {profile?.bio && (
              <p className="profile-bio">{profile.bio}</p>
            )}
            {user?.date_joined && (
              <div className="profile-member-since">
                Member Since: {formatMemberSince(user.date_joined)}
              </div>
            )}
            <button 
              className="btn-edit-profile"
              onClick={() => setShowEditModal(true)}
            >
              Edit Profile
            </button>
          </div>

          {/* My Lists Section */}
          <div className="profile-lists-section">
            <div className="section-header">
              <h3>MY LISTS</h3>
              <button 
                className="btn-add-list"
                onClick={() => navigate('/my-lists')}
                title="Add new list"
              >
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
            {listsLoading ? (
              <div className="lists-loading">Loading lists...</div>
            ) : !Array.isArray(lists) || lists.length === 0 ? (
              <div className="lists-empty">
                <p>No lists yet</p>
                <Link to="/my-lists" className="link-create-list">Create List</Link>
              </div>
            ) : (
              <div className="lists-items">
                {lists.slice(0, 5).map((list) => (
                  <Link key={list.id} to={`/lists/${list.id}`} className="list-item">
                    <span className="list-name">{list.name}</span>
                    <span className="list-count">({list.problem_count || 0})</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="profile-main-content">
          {/* Welcome Header */}
          <div className="dashboard-welcome-header">
            <div className="welcome-message">
              <h1>Welcome back, {user?.username || 'Alex'}</h1>
              <p>You have {ticks.length} total sends</p>
            </div>
            <div className="welcome-actions">
              <button 
                className="btn-view-public"
                onClick={() => {
                  if (user?.id) {
                    navigate(`/user/${user.id}`);
                  } else {
                    console.error('User ID not available');
                  }
                }}
              >
                <span className="material-symbols-outlined">visibility</span>
                View as Public
              </button>
              <button 
                className="btn-import-lezec"
                onClick={() => setShowLezecImportModal(true)}
              >
                <span className="material-symbols-outlined">download</span>
                Import Lezec
              </button>
              <button 
                className="btn-log-ascent"
                onClick={() => navigate('/problems')}
              >
                <span className="material-symbols-outlined">add</span>
                Log Ascent
              </button>
            </div>
          </div>

          {/* Performance Metrics Card */}
          {!statsLoading && (
            <div className="performance-metrics-card">
              <div className="card-header">
                <div className="card-title">
                  <span className="material-symbols-outlined">bar_chart</span>
                  <h3>PERFORMANCE METRICS</h3>
                </div>
                <span className="card-label-private">Private View</span>
              </div>
              <div className="metrics-grid">
                <div className="metric-item">
                  <span className="metric-label">Total Sends</span>
                  <span className="metric-value">{totalSends}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Hardest Grade</span>
                  <span className="metric-value">{maxGrade}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">First Ascents</span>
                  <span className="metric-value">{firstAscents}</span>
                </div>
                <div className="metric-item">
                  <span className="metric-label">Days Out</span>
                  <span className="metric-value">{daysOut}</span>
                </div>
              </div>
            </div>
          )}

          {/* Grade Distribution Card */}
          {!statsLoading && statistics?.grade_distribution && Object.keys(statistics.grade_distribution).length > 0 && (
            <div className="grade-pyramid-card">
              <div className="card-header">
                <div className="card-title">
                  <h3>Grade Pyramid</h3>
                  <span className="card-subtitle">All time • Font Scale</span>
                </div>
              </div>
              <div className="grade-pyramid">
                {Object.entries(statistics.grade_distribution)
                  .filter(([_, count]) => count > 0)
                  .sort((a, b) => {
                    const gradeA = GRADE_CHOICES.indexOf(a[0]);
                    const gradeB = GRADE_CHOICES.indexOf(b[0]);
                    return gradeA - gradeB;
                  })
                  .map(([grade, count]) => {
                    const maxCount = Math.max(...Object.values(statistics.grade_distribution).filter(c => c > 0));
                    const widthPercentage = (count / maxCount) * 100;
                    return (
                      <div key={grade} className="grade-pyramid-item">
                        <div className="grade-pyramid-bar-container">
                          <div 
                            className="grade-pyramid-bar" 
                            style={{ width: `${widthPercentage}%` }}
                          />
                        </div>
                        <div className="grade-pyramid-label">
                          <span className="grade-pyramid-grade">{grade}</span>
                          <span className="grade-pyramid-count">{count}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Ticklist Table Section */}
          <div className="ticklist-section">
            <div className="ticklist-header">
              <div className="ticklist-tabs">
                <button
                  className={`ticklist-tab ${activeTab === 'ticks' ? 'active' : ''}`}
                  onClick={() => setActiveTab('ticks')}
                >
                  Ticklist
                </button>
                <button
                  className={`ticklist-tab ${activeTab === 'lists' ? 'active' : ''}`}
                  onClick={() => setActiveTab('lists')}
                >
                  Lists
                </button>
                <button
                  className={`ticklist-tab ${activeTab === 'projects' ? 'active' : ''}`}
                  onClick={() => setActiveTab('projects')}
                >
                  Projects
                </button>
              </div>
              <div className="ticklist-actions">
                <span className="ticklist-manage">MANAGE</span>
                <button className="ticklist-action-btn" onClick={() => navigate('/problems')}>
                  <span className="material-symbols-outlined">add</span>
                </button>
                <button className="ticklist-action-btn">
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>

            {activeTab === 'ticks' && (
              <>
                <div className="ticklist-toolbar">
                  <div className="filter-dropdown-wrapper" ref={gradeFilterRef}>
                    <button 
                      className={`filter-button ${gradeFilter !== 'all' ? 'active' : ''} ${showGradeDropdown ? 'open' : ''}`}
                      onClick={() => {
                        setShowGradeDropdown(!showGradeDropdown);
                        setShowStyleDropdown(false);
                      }}
                    >
                      Filter by: {gradeFilter === 'all' ? 'Most Recent' : gradeFilter}
                      <span className="material-symbols-outlined">expand_more</span>
                    </button>
                    {showGradeDropdown && (
                      <div className="filter-dropdown">
                        <button
                          className={`filter-dropdown-option ${gradeFilter === 'all' ? 'active' : ''}`}
                          onClick={() => {
                            setGradeFilter('all');
                            setShowGradeDropdown(false);
                            setCurrentPage(1);
                          }}
                        >
                          Most Recent
                        </button>
                        {availableGrades.grades.map((grade) => (
                          <button
                            key={grade}
                            className={`filter-dropdown-option ${gradeFilter === grade ? 'active' : ''}`}
                            onClick={() => {
                              setGradeFilter(gradeFilter === grade ? 'all' : grade);
                              setShowGradeDropdown(false);
                              setCurrentPage(1);
                            }}
                          >
                            {grade}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <Link to="/profile" className="export-link">Export CSV</Link>
                </div>

                <div className="dashboard-table-container">
                  {loading ? (
                    <div className="loading">Loading your ticks...</div>
                  ) : error ? (
                    <div className="error-message">{error}</div>
                  ) : paginatedTicks.length === 0 ? (
                    <div className="empty-state">
                      <p>No ascents found.</p>
                      <p>
                        <Link to="/problems">Browse problems</Link> to start tracking your sends!
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="table-wrapper">
                        <table className="dashboard-table">
                          <thead>
                            <tr>
                              <th>Grade</th>
                              <th>Route Name</th>
                              <th>Date</th>
                              <th>Style</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedTicks.map((tick) => (
                              <tr key={tick.id}>
                                <td className="grade-cell">
                                  {tick.problem && tick.tick_grade && tick.tick_grade !== tick.problem.grade ? (
                                    <>
                                      <span title="Grade you climbed">{tick.tick_grade}</span>
                                      <span> / </span>
                                      <span title="Problem grade">{tick.problem.grade}</span>
                                    </>
                                  ) : (
                                    tick.problem?.grade || '-'
                                  )}
                                </td>
                                <td className="route-cell">
                                  <div className="route-cell-content">
                                    {tick.problem ? (
                                      <Link to={`/problems/${tick.problem.id}`} className="route-link">
                                        {tick.problem.name}
                                      </Link>
                                    ) : (
                                      <span>Unknown Problem</span>
                                    )}
                                    {tick.rating && (
                                      <span className="route-rating">
                                        <StarRating rating={parseFloat(tick.rating)} size="small" showValue={false} />
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="date-cell">{formatDate(tick.date)}</td>
                                <td className="style-cell">
                                  {(() => {
                                    const style = getTickStyle(tick);
                                    const styleLabels = {
                                      'send': 'Send',
                                      'flash': 'Flash',
                                      'solo': 'Solo'
                                    };
                                    const styleClass = style === 'flash' ? 'style-flash' : 'style-redpoint';
                                    return (
                                      <span className={`style-badge ${styleClass}`}>
                                        {styleLabels[style] || 'Send'}
                                      </span>
                                    );
                                  })()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {totalPages > 1 && (
                        <div className="ticklist-pagination">
                          <button
                            className="pagination-btn"
                            onClick={() => setCurrentPage(currentPage - 1)}
                            disabled={currentPage === 1}
                          >
                            <span className="material-symbols-outlined">chevron_left</span>
                          </button>
                          <span className="pagination-info">
                            Page {currentPage} of {totalPages}
                          </span>
                          <button
                            className="pagination-btn"
                            onClick={() => setCurrentPage(currentPage + 1)}
                            disabled={currentPage === totalPages}
                          >
                            <span className="material-symbols-outlined">chevron_right</span>
                          </button>
                        </div>
                      )}
                      <div className="ticklist-footer">
                        <Link to="/profile" className="view-full-history">
                          View full history ({filteredTicks.length})
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}

            {activeTab === 'lists' && (
              <div className="lists-content">
                {listsLoading ? (
                  <div className="loading">Loading your lists...</div>
                ) : !Array.isArray(lists) || lists.length === 0 ? (
                  <div className="empty-state">
                    <p>You haven&apos;t created any lists yet.</p>
                    <Link to="/my-lists" className="btn-primary">Create New List</Link>
                  </div>
                ) : (
                  <div className="recent-lists-grid">
                    {lists.map((list) => (
                      <Link
                        key={list.id}
                        to={`/lists/${list.id}`}
                        className="list-card"
                      >
                        <div className="list-card-content">
                          <h3>{list.name}</h3>
                          <p>{list.problem_count || 0} Problems</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'projects' && (
              <div className="projects-content">
                <div className="empty-state">
                  <p>No active projects yet.</p>
                  <Link to="/my-lists" className="btn-primary">Create Project List</Link>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content profile-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Profile</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="profile-form">
              <div className="form-section">
                <h3>Basic Information</h3>
                
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
                <h3>Physical Stats</h3>
                <p className="section-description">
                  Help improve statistics by sharing your height and ape index.
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
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lezec Import Modal */}
      {showLezecImportModal && (
        <div className="modal-overlay" onClick={() => setShowLezecImportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Import from Lezec.cz</h2>
              <button className="modal-close" onClick={() => setShowLezecImportModal(false)}>×</button>
            </div>
            <div className="lezec-import-content">
              <p className="section-description">
                Import your completed boulder problems (ticks) from your public lezec.cz diary. 
                Only boulders from Moravský Kras will be imported.
              </p>

              {importResult && (
                <div className={`import-result ${importResult.success ? 'success' : 'error'}`}>
                  <h4>{importResult.success ? '✓ Import Completed' : '✗ Import Failed'}</h4>
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
                  <h4>Confirm Import</h4>
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
                    <label htmlFor="lezec_username_modal">Lezec.cz Username</label>
                    <input
                      type="text"
                      id="lezec_username_modal"
                      value={lezecUsername}
                      onChange={(e) => setLezecUsername(e.target.value)}
                      placeholder="e.g., Lucaa"
                      disabled={importing}
                    />
                    <small>Enter your lezec.cz username (your diary must be public)</small>
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      onClick={handleLezecImport}
                      disabled={importing || !lezecUsername.trim()}
                      className="btn btn-primary"
                    >
                      {importing ? 'Importing...' : 'Import Ticks'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLezecImportModal(false)}
                      className="btn btn-secondary"
                      disabled={importing}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Tick Modal */}
      {showTickEditModal && editingTick && (
        <div className="modal-overlay" onClick={() => setShowTickEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Tick - {editingTick.problem.name}</h2>
              <button className="modal-close" onClick={() => setShowTickEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleEditSubmit} className="tick-form">
              <div className="form-group">
                <label htmlFor="edit-tick-date">Date:</label>
                <input
                  type="date"
                  id="edit-tick-date"
                  value={tickFormData.date}
                  onChange={(e) => setTickFormData({ ...tickFormData, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-tick-grade">Grade You Climbed (Optional):</label>
                <select
                  id="edit-tick-grade"
                  value={tickFormData.tick_grade}
                  onChange={(e) => setTickFormData({ ...tickFormData, tick_grade: e.target.value })}
                >
                  <option value="">Same as problem grade ({editingTick.problem.grade})</option>
                  {GRADE_CHOICES.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit-suggested-grade">Suggested Grade (Optional):</label>
                <select
                  id="edit-suggested-grade"
                  value={tickFormData.suggested_grade}
                  onChange={(e) => setTickFormData({ ...tickFormData, suggested_grade: e.target.value })}
                >
                  <option value="">No grade suggestion</option>
                  {GRADE_CHOICES.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="edit-tick-rating">Rate this Problem (Optional):</label>
                <StarRating
                  rating={tickFormData.rating || 0}
                  onChange={(rating) => setTickFormData({ ...tickFormData, rating: rating })}
                  editable={true}
                  size="medium"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-tick-notes">Notes (Optional):</label>
                <textarea
                  id="edit-tick-notes"
                  value={tickFormData.notes}
                  onChange={(e) => setTickFormData({ ...tickFormData, notes: e.target.value })}
                  rows="3"
                  placeholder="Add any notes about your send..."
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={async () => {
                    if (window.confirm('Are you sure you want to delete this tick?')) {
                      try {
                        await ticksAPI.delete(editingTick.id);
                        setShowTickEditModal(false);
                        setEditingTick(null);
                        fetchTicks();
                        fetchStatistics();
                      } catch (err) {
                        console.error('Failed to delete tick:', err);
                        alert('Failed to delete tick. Please try again.');
                      }
                    }
                  }}
                >
                  Delete Tick
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTickEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Tick
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
