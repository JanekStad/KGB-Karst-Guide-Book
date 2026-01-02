import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StarRating from '../components/StarRating';
import { useAuth } from '../contexts/AuthContext';
import { listsAPI, problemsAPI, ticksAPI, usersAPI } from '../services/api';
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

const _getInitials = (name) => {
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
  const [_profile, setProfile] = useState(null);
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
  const [selectedList, setSelectedList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [listsLoading, setListsLoading] = useState(true);
  const [editingTick, setEditingTick] = useState(null);
  const [showTickEditModal, setShowTickEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState('ticks');
  const [searchQuery] = useState('');
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [databaseSearchQuery, setDatabaseSearchQuery] = useState('');
  const [databaseSearchResults, setDatabaseSearchResults] = useState([]);
  const [databaseSearchLoading, setDatabaseSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [statusFilter, setStatusFilter] = useState('todo');
  const searchResultsRef = useRef(null);
  const [gradeFilter, setGradeFilter] = useState('all');
  const [styleFilter] = useState('all');
  const [showGradeDropdown, setShowGradeDropdown] = useState(false);
  const [showStyleDropdown, setShowStyleDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [createListFormData, setCreateListFormData] = useState({
    name: '',
    description: '',
    is_public: false,
  });
  const [creatingList, setCreatingList] = useState(false);
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

  useEffect(() => {
    // Auto-select first list when switching to lists tab
    if (activeTab === 'lists' && lists.length > 0 && !selectedList) {
      fetchListDetails(lists[0].id);
    }
  }, [activeTab, lists]);

  // Database search with debouncing
  useEffect(() => {
    if (!databaseSearchQuery.trim() || !selectedList) {
      setDatabaseSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    const searchTimeout = setTimeout(async () => {
      try {
        setDatabaseSearchLoading(true);
        const response = await problemsAPI.list({ 
          search: databaseSearchQuery,
          limit: 10 
        });
        const problems = response.data?.results || response.data || [];
        // Filter out problems already in the list
        const existingProblemIds = new Set(
          selectedList.problems?.map(p => p.problem?.id).filter(Boolean) || []
        );
        const filteredProblems = problems.filter(p => !existingProblemIds.has(p.id));
        setDatabaseSearchResults(filteredProblems);
        setShowSearchResults(true);
      } catch (err) {
        console.error('Failed to search problems:', err);
        setDatabaseSearchResults([]);
      } finally {
        setDatabaseSearchLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(searchTimeout);
  }, [databaseSearchQuery, selectedList]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchResultsRef.current && !searchResultsRef.current.contains(event.target)) {
        setShowSearchResults(false);
      }
    };

    if (showSearchResults) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSearchResults]);

  const handleAddProblemToList = async (problem, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!selectedList) return;

    try {
      await listsAPI.addProblem(selectedList.id, { problem: problem.id });
      await fetchListDetails(selectedList.id);
      setDatabaseSearchQuery('');
      setListSearchQuery('');
      setShowSearchResults(false);
      setError(null);
    } catch (err) {
      console.error('Failed to add problem to list:', err);
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message ||
                          'Failed to add problem to list.';
      setError(errorMessage);
    }
  };

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
      const listsArray = Array.isArray(listsData) ? listsData : [];
      setLists(listsArray);
      
      // Auto-select first list if available and no list is selected
      if (listsArray.length > 0 && !selectedList && activeTab === 'lists') {
        fetchListDetails(listsArray[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch lists:', err);
      setLists([]); // Ensure lists is always an array
    } finally {
      setListsLoading(false);
    }
  };

  const fetchListDetails = async (listId) => {
    try {
      const response = await listsAPI.get(listId);
      setSelectedList(response.data);
    } catch (err) {
      console.error('Failed to fetch list details:', err);
      setError('Failed to load list details.');
    }
  };

  const handleSelectList = (list) => {
    if (selectedList?.id !== list.id) {
      fetchListDetails(list.id);
    }
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!createListFormData.name.trim()) {
      setError('List name is required');
      return;
    }

    setCreatingList(true);
    setError(null);

    try {
      const response = await listsAPI.create(createListFormData);
      const newList = response.data;
      await fetchListDetails(newList.id);
      setLists([...lists, newList]);
      setShowCreateListModal(false);
      setCreateListFormData({ name: '', description: '', is_public: false });
      setError(null);
    } catch (err) {
      console.error('Failed to create list:', err);
      const errorMessage = err.response?.data?.name?.[0] || 
                          err.response?.data?.detail ||
                          'Failed to create list. Please try again.';
      setError(errorMessage);
    } finally {
      setCreatingList(false);
    }
  };

  const handleDeleteList = async (listId) => {
    if (!window.confirm('Are you sure you want to delete this list?')) {
      return;
    }

    try {
      await listsAPI.delete(listId);
      const updatedLists = lists.filter(l => l.id !== listId);
      setLists(updatedLists);
      if (selectedList?.id === listId) {
        setSelectedList(updatedLists.length > 0 ? updatedLists[0] : null);
        if (updatedLists.length > 0) {
          fetchListDetails(updatedLists[0].id);
        } else {
          setSelectedList(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete list:', err);
      setError('Failed to delete list. Please try again.');
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

  const _handleEdit = (tick) => {
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

  const _formatMemberSince = (dateString) => {
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
  const _activeProjects = Array.isArray(lists) ? lists.length : 0;
  const _firstAscents = statistics?.first_ascents || 0;
  const daysOut = statistics?.unique_days || 0;

  const getCompletionPercentage = (problems) => {
    if (!problems || problems.length === 0) return 0;
    // For now, we'll assume a problem is "completed" if it has been ticked
    // This would need to be checked against user's ticks
    return 0; // Placeholder - would need tick data
  };

  const getGradeRange = (problems) => {
    if (!problems || problems.length === 0) return '-';
    const grades = problems.map(p => p.problem?.grade).filter(Boolean);
    if (grades.length === 0) return '-';
    const sortedGrades = grades.sort((a, b) => {
      const gradeOrder = GRADE_CHOICES;
      return gradeOrder.indexOf(a) - gradeOrder.indexOf(b);
    });
    const min = sortedGrades[0];
    const max = sortedGrades[sortedGrades.length - 1];
    return min === max ? min : `${min} - ${max}`;
  };

  const filteredListProblems = selectedList?.problems?.filter(entry => {
    if (!entry?.problem) return false;
    
    // Filter by search query (applies to both database search and existing problems filter)
    const query = listSearchQuery.toLowerCase();
    const problem = entry.problem;
    const matchesSearch = !query || 
      problem?.name?.toLowerCase().includes(query) ||
      problem?.grade?.toLowerCase().includes(query) ||
      problem?.area?.name?.toLowerCase().includes(query);
    
    // Status filter would check if problem is ticked
    // For now, all are "todo" until we integrate tick data
    const matchesStatus = statusFilter === 'all' || statusFilter === 'todo';
    
    return matchesSearch && matchesStatus;
  }) || [];

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

      <main className="profile-main-content">
        {/* Welcome Header */}
        <div className="dashboard-welcome-header">
          <div className="welcome-message">
            <h1>Welcome back, {user?.username || 'Alex'}</h1>
            <p>Track your sends and manage your projects.</p>
          </div>
          <div className="welcome-actions">
            <button 
              className="btn-edit-profile-top"
              onClick={() => setShowEditModal(true)}
            >
              <span className="material-symbols-outlined">edit</span>
              Edit Profile
            </button>
            <button 
              className="btn-import-lezec"
              onClick={() => setShowLezecImportModal(true)}
            >
              <span className="material-symbols-outlined">download</span>
              Import from lezec.cz
            </button>
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
              View as public
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

        {/* Statistics Cards */}
        {!statsLoading && (
          <div className="statistics-grid">
            <div className="stat-card">
              <div className="stat-header">
                <p className="stat-label">Total Sends</p>
                <span className="material-symbols-outlined stat-icon">check_circle</span>
              </div>
              <p className="stat-value">{totalSends}</p>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <p className="stat-label">Max Grade</p>
                <span className="material-symbols-outlined stat-icon">landscape</span>
              </div>
              <p className="stat-value">{maxGrade}</p>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <p className="stat-label">Active Projects</p>
                <span className="material-symbols-outlined stat-icon">bookmark</span>
              </div>
              <p className="stat-value">{Array.isArray(lists) ? lists.length : 0}</p>
            </div>
            <div className="stat-card">
              <div className="stat-header">
                <p className="stat-label">Days Out</p>
                <span className="material-symbols-outlined stat-icon">event</span>
              </div>
              <p className="stat-value">{daysOut}</p>
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
          <div className="ticklist-tabs-container">
            <nav className="ticklist-tabs" aria-label="Tabs">
              <button
                className={`ticklist-tab ${activeTab === 'ticks' ? 'active' : ''}`}
                onClick={() => setActiveTab('ticks')}
              >
                <span className="material-symbols-outlined">history</span>
                My Tick List
                {activeTab === 'ticks' && (
                  <span className="tab-badge">{ticks.length}</span>
                )}
              </button>
              <button
                className={`ticklist-tab ${activeTab === 'lists' ? 'active' : ''}`}
                onClick={() => setActiveTab('lists')}
              >
                <span className="material-symbols-outlined">format_list_bulleted</span>
                Personal Lists & Projects
                {activeTab === 'lists' && lists.length > 0 && (
                  <span className="tab-badge">{lists.length}</span>
                )}
              </button>
            </nav>
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
              <div className="lists-tab-content">
                {listsLoading ? (
                  <div className="loading">Loading your lists...</div>
                ) : (
                  <div className="lists-layout">
                    {/* Left Sidebar - List Cards */}
                    <aside className="profile-lists-sidebar">
                      <div className="sidebar-header">
                        <h3 className="sidebar-title">Your Lists</h3>
                        <button className="sort-button" title="Sort lists">
                          <span className="material-symbols-outlined">sort</span>
                        </button>
                      </div>
                      
                      <div className="lists-scroll-container">
                        {!Array.isArray(lists) || lists.length === 0 ? (
                          <div className="empty-lists-sidebar">
                            <p>No lists yet</p>
                          </div>
                        ) : (
                          lists.map((list) => {
                            const isSelected = selectedList?.id === list.id;
                            const completion = getCompletionPercentage(list.problems);
                            const problemCount = list.problem_count || list.problems?.length || 0;
                            
                            return (
                              <div
                                key={list.id}
                                className={`profile-list-card ${isSelected ? 'selected' : ''}`}
                                onClick={() => handleSelectList(list)}
                              >
                                <div className="list-card-header">
                                  <h4 className="list-card-name">{list.name}</h4>
                                  {isSelected && (
                                    <span className="material-symbols-outlined pin-icon">push_pin</span>
                                  )}
                                </div>
                                {list.description && (
                                  <p className="list-card-description">{list.description}</p>
                                )}
                                <div className="list-card-stats">
                                  <span className="list-stat">
                                    <span className="material-symbols-outlined">landscape</span>
                                    {problemCount} items
                                  </span>
                                  <span className="list-stat">
                                    <span className="material-symbols-outlined">check_circle</span>
                                    0 sent
                                  </span>
                                </div>
                                {problemCount > 0 && (
                                  <div className="list-progress-bar">
                                    <div 
                                      className="list-progress-fill" 
                                      style={{ width: `${completion}%` }}
                                    />
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>

                      <button 
                        className="create-list-button"
                        onClick={() => setShowCreateListModal(true)}
                      >
                        <div className="create-list-icon">
                          <span className="material-symbols-outlined">add</span>
                        </div>
                        <span>Create New List</span>
                      </button>
                    </aside>

                    {/* Right Side - List Details */}
                    <main className="profile-list-detail">
                      {selectedList ? (
                        <>
                          {/* List Header */}
                          <div className="list-detail-header">
                            <div className="list-detail-info">
                              <h2 className="list-detail-title">{selectedList.name}</h2>
                              <div className="list-detail-meta">
                                <span>Created {formatDate(selectedList.created_at)}</span>
                                <span className="meta-separator"></span>
                                <span>{selectedList.problem_count || 0} Problems</span>
                                {selectedList.problem_count > 0 && (
                                  <>
                                    <span className="meta-separator"></span>
                                    <span className="grade-range">{getGradeRange(selectedList.problems)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                            <div className="list-detail-actions">
                              <button className="action-button" title="Edit list">
                                <span className="material-symbols-outlined">edit</span>
                              </button>
                              <button 
                                className="action-button delete-button"
                                onClick={() => handleDeleteList(selectedList.id)}
                                title="Delete list"
                              >
                                <span className="material-symbols-outlined">delete</span>
                              </button>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          {selectedList.problem_count > 0 && (
                            <div className="list-progress-section">
                              <div className="list-progress-track">
                                <div 
                                  className="list-progress-indicator" 
                                  style={{ width: `${getCompletionPercentage(selectedList.problems)}%` }}
                                />
                              </div>
                              <span className="progress-text">
                                {getCompletionPercentage(selectedList.problems)}% Complete
                              </span>
                            </div>
                          )}

                          {/* Search and Filters */}
                          <div className="list-search-section">
                            <div className="search-input-wrapper" ref={searchResultsRef}>
                              <span className="search-icon material-symbols-outlined">search</span>
                              <input
                                type="text"
                                className="search-input"
                                placeholder="Search database to add problems..."
                                value={databaseSearchQuery}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setDatabaseSearchQuery(value);
                                  // Also update filter for existing problems
                                  setListSearchQuery(value);
                                }}
                                onFocus={() => {
                                  if (databaseSearchQuery && databaseSearchResults.length > 0) {
                                    setShowSearchResults(true);
                                  }
                                }}
                                onBlur={() => {
                                  // Don't hide immediately, let click handler manage it
                                  setTimeout(() => setShowSearchResults(false), 200);
                                }}
                              />
                              {databaseSearchLoading && (
                                <span className="search-loading">Loading...</span>
                              )}
                              {showSearchResults && databaseSearchResults.length > 0 && (
                                <div className="search-results-dropdown">
                                  {databaseSearchResults.map((problem) => (
                                    <button
                                      key={problem.id}
                                      className="search-result-item"
                                      onClick={(e) => handleAddProblemToList(problem, e)}
                                      type="button"
                                    >
                                      <div className="search-result-content">
                                        <div className="search-result-name">{problem.name}</div>
                                        <div className="search-result-meta">
                                          <span className="search-result-grade">{problem.grade}</span>
                                          {problem.area && (
                                            <span className="search-result-area">{problem.area.name}</span>
                                          )}
                                        </div>
                                      </div>
                                      <span className="material-symbols-outlined search-result-icon">add</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {showSearchResults && databaseSearchQuery && databaseSearchResults.length === 0 && !databaseSearchLoading && (
                                <div className="search-results-dropdown">
                                  <div className="search-result-empty">No problems found</div>
                                </div>
                              )}
                              <button 
                                className="browse-button"
                                onClick={() => navigate('/problems')}
                              >
                                Browse Database
                              </button>
                            </div>
                            <div className="filter-tags">
                              <button 
                                className={`filter-tag ${statusFilter === 'all' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('all')}
                              >
                                All Grades
                              </button>
                              <button 
                                className={`filter-tag ${statusFilter === 'todo' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('todo')}
                              >
                                To Do
                              </button>
                              <button 
                                className={`filter-tag ${statusFilter === 'sent' ? 'active' : ''}`}
                                onClick={() => setStatusFilter('sent')}
                              >
                                Sent
                              </button>
                            </div>
                          </div>

                          {/* Problems Table */}
                          <div className="dashboard-table-container">
                            {filteredListProblems.length === 0 ? (
                              <div className="empty-state">
                                {selectedList.problem_count === 0 ? (
                                  <>
                                    <p>No problems in this list yet.</p>
                                    <p>
                                      <button 
                                        className="btn-link"
                                        onClick={() => navigate('/problems')}
                                      >
                                        Browse problems
                                      </button> to add some!
                                    </p>
                                  </>
                                ) : (
                                  <p>No problems match your current search or filter.</p>
                                )}
                              </div>
                            ) : (
                              <div className="table-wrapper">
                                <table className="dashboard-table">
                                  <thead>
                                    <tr>
                                      <th></th>
                                      <th>Grade</th>
                                      <th>Route</th>
                                      <th>Area</th>
                                      <th>Status</th>
                                      <th></th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredListProblems.map((entry, index) => {
                                      const problem = entry.problem;
                                      if (!problem) return null;
                                      
                                      return (
                                        <tr key={entry.id || index} className={index % 2 === 1 ? 'highlighted' : ''}>
                                          <td className="drag-handle">
                                            <span className="material-symbols-outlined">drag_indicator</span>
                                          </td>
                                          <td className="grade-cell">{problem.grade || '-'}</td>
                                          <td className="route-cell">
                                            <Link 
                                              to={`/problems/${problem.id}`}
                                              className="route-link"
                                            >
                                              {problem.name || 'Unknown'}
                                            </Link>
                                          </td>
                                          <td className="area-cell">
                                            {problem.area ? (
                                              <Link 
                                                to={`/areas/${problem.area.id}`}
                                                className="area-link"
                                              >
                                                {problem.area.name}
                                              </Link>
                                            ) : '-'}
                                          </td>
                                          <td className="status-cell">
                                            <span className="status-badge todo">Project</span>
                                          </td>
                                          <td className="action-cell">
                                            <button 
                                              className="remove-button"
                                              onClick={() => {
                                                listsAPI.removeProblem(selectedList.id, problem.id)
                                                  .then(() => fetchListDetails(selectedList.id))
                                                  .catch(err => console.error('Failed to remove:', err));
                                              }}
                                              title="Remove from list"
                                            >
                                              <span className="material-symbols-outlined">remove_circle</span>
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>

                          {/* Table Footer */}
                          {filteredListProblems.length > 0 && (
                            <div className="table-footer">
                              <span className="footer-text">Drag items to reorder your priority list.</span>
                              <div className="footer-actions">
                                <button className="footer-link">Export CSV</button>
                                <button className="footer-link">Print Guide</button>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="empty-list-state">
                          {lists.length === 0 ? (
                            <>
                              <h3>No Lists Yet</h3>
                              <p>Create your first list to start organizing your projects!</p>
                              <button 
                                className="btn-primary"
                                onClick={() => setShowCreateListModal(true)}
                              >
                                <span className="material-symbols-outlined">add</span>
                                Create New List
                              </button>
                            </>
                          ) : (
                            <>
                              <h3>Select a List</h3>
                              <p>Choose a list from the sidebar to view its problems.</p>
                            </>
                          )}
                        </div>
                      )}
                    </main>
                  </div>
                )}
              </div>
            )}

        </div>
      </main>

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

      {/* Create List Modal */}
      {showCreateListModal && (
        <div className="modal-overlay" onClick={() => setShowCreateListModal(false)}>
          <div className="modal-content create-list-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New List</h2>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowCreateListModal(false);
                  setCreateListFormData({ name: '', description: '', is_public: false });
                  setError(null);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateList} className="create-list-form">
              <div className="form-group">
                <label htmlFor="list-name">List Name *</label>
                <input
                  type="text"
                  id="list-name"
                  value={createListFormData.name}
                  onChange={(e) => setCreateListFormData({ ...createListFormData, name: e.target.value })}
                  placeholder="e.g., Bishop Trip 2024"
                  required
                  maxLength={200}
                />
              </div>
              <div className="form-group">
                <label htmlFor="list-description">Description</label>
                <textarea
                  id="list-description"
                  value={createListFormData.description}
                  onChange={(e) => setCreateListFormData({ ...createListFormData, description: e.target.value })}
                  placeholder="Optional description for this list..."
                  rows="4"
                  maxLength={500}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={createListFormData.is_public}
                    onChange={(e) => setCreateListFormData({ ...createListFormData, is_public: e.target.checked })}
                  />
                  <span>Make this list public</span>
                </label>
              </div>
              <div className="modal-actions">
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowCreateListModal(false);
                    setCreateListFormData({ name: '', description: '', is_public: false });
                    setError(null);
                  }}
                  disabled={creatingList}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                  disabled={creatingList || !createListFormData.name.trim()}
                >
                  {creatingList ? 'Creating...' : 'Create List'}
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
