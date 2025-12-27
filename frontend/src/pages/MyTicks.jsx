import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StarRating from '../components/StarRating';
import { useAuth } from '../contexts/AuthContext';
import { listsAPI, ticksAPI } from '../services/api';
import './MyTicks.css';

const GRADE_CHOICES = ['3', '3+', '4', '4+', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+', '7A', '7A+', '7B', '7B+', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A', '9A+'];
const STYLE_CHOICES = ['send', 'flash', 'solo']; // 'solo' is alternative name for 'send'

// Get tick style - for now, default to 'send' since there's no style field in the model
const getTickStyle = (tick) => {
  // TODO: When style field is added to model, return tick.style
  // For now, check notes for imported style info, otherwise default to 'send'
  if (tick.notes?.toLowerCase().includes('style:')) {
    const styleMatch = tick.notes.toLowerCase().match(/style:\s*(\w+)/);
    if (styleMatch) {
      const style = styleMatch[1].toLowerCase();
      if (STYLE_CHOICES.includes(style) || style === 'redpoint') {
        return style === 'redpoint' ? 'send' : style;
      }
    }
  }
  return 'send'; // Default to 'send' (redpoint)
};

const MyTicks = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [ticks, setTicks] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [listsLoading, setListsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingTick, setEditingTick] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState('ticks'); // 'ticks' or 'lists'
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

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    fetchTicks();
    fetchStatistics();
    fetchLists();
  }, [isAuthenticated, navigate]);

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
      setLists(response.data || []);
    } catch (err) {
      console.error('Failed to fetch lists:', err);
    } finally {
      setListsLoading(false);
    }
  };
  const _handleDelete = async (tickId) => {
    if (!window.confirm('Are you sure you want to delete this tick?')) {
      return;
    }

    try {
      await ticksAPI.delete(tickId);
      setTicks(ticks.filter(tick => tick.id !== tickId));
      fetchStatistics();
    } catch (err) {
      console.error('Failed to delete tick:', err);
      alert('Failed to delete tick. Please try again.');
    }
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
    setShowEditModal(true);
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
      console.log('✅ Tick updated');
      setShowEditModal(false);
      setEditingTick(null);
      fetchTicks();
      fetchStatistics();
    } catch (err) {
      console.error('❌ Failed to update tick:', err);
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

  // Get available grades from ticks
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

  // Filter ticks based on search and filters
  const filteredTicks = useMemo(() => {
    return ticks.filter(tick => {
      const matchesSearch = !searchQuery || 
        tick.problem?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tick.problem?.crag && tick.problem.crag.name?.toLowerCase().includes(searchQuery.toLowerCase()));
      
      // Use tick_grade if available, otherwise problem grade
      const effectiveGrade = tick.tick_grade || tick.problem?.grade;
      const matchesGrade = gradeFilter === 'all' || effectiveGrade === gradeFilter;
      
      const tickStyle = getTickStyle(tick);
      const matchesStyle = styleFilter === 'all' || tickStyle === styleFilter;
      
      return matchesSearch && matchesGrade && matchesStyle;
    });
  }, [ticks, searchQuery, gradeFilter, styleFilter]);

  // Close dropdowns when clicking outside
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

  // Pagination
  const totalPages = Math.ceil(filteredTicks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTicks = filteredTicks.slice(startIndex, startIndex + itemsPerPage);

  // Calculate stats for display
  const totalSends = statistics?.total_ticks || ticks.length;
  const maxGrade = statistics?.hardest_grade || '-';
  const activeProjects = lists.length || 0;

  // Generate activity chart data (last 7 days for simplicity)
  const getActivityData = () => {
    const days = 7;
    const data = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const ticksOnDay = ticks.filter(tick => {
        const tickDate = new Date(tick.date);
        return tickDate.toDateString() === date.toDateString();
      }).length;
      data.push(ticksOnDay);
    }
    const max = Math.max(...data, 1);
    return data.map(count => (count / max) * 100);
  };

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="my-ticks-dashboard">
      {/* Welcome Section */}
      <div className="dashboard-header">
        <div className="dashboard-welcome">
          <h1>Welcome back, {user?.username || 'Alex'}</h1>
          <p>Track your sends and manage your projects.</p>
        </div>
        <button 
          className="btn-log-ascent"
          onClick={() => navigate('/problems')}
        >
          <span className="material-symbols-outlined">add</span>
          Log Ascent
        </button>
      </div>

      {/* Stats Grid */}
      {!statsLoading && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-header">
              <p className="stat-label">Total Sends</p>
              <span className="material-symbols-outlined stat-icon">check_circle</span>
            </div>
            <p className="stat-value">{totalSends}</p>
            <div className="stat-trend">
              <span className="material-symbols-outlined">trending_up</span>
              <span>Recent activity</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <p className="stat-label">Max Grade</p>
              <span className="material-symbols-outlined stat-icon">landscape</span>
            </div>
            <p className="stat-value">{maxGrade}</p>
            {statistics?.latest_send && (
              <p className="stat-subtext">
                Last PB: {formatDate(statistics.latest_send)}
              </p>
            )}
          </div>

          <div className="stat-card">
            <div className="stat-header">
              <p className="stat-label">Active Projects</p>
              <span className="material-symbols-outlined stat-icon">bookmark</span>
            </div>
            <p className="stat-value">{activeProjects}</p>
            <p className="stat-subtext">Personal lists</p>
          </div>

          <div className="stat-card stat-card-chart">
            <p className="stat-label">Activity (7d)</p>
            <div className="activity-chart">
              {getActivityData().map((height, index) => (
                <div
                  key={index}
                  className="activity-bar"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Extended Statistics Section */}
      {!statsLoading && statistics && (
        <div className="extended-statistics">
          {/* Additional Stats Cards */}
          <div className="additional-stats-grid">
            {statistics.unique_crags > 0 && (
              <div className="stat-card">
                <div className="stat-header">
                  <p className="stat-label">Crags Visited</p>
                </div>
                <p className="stat-value">{statistics.unique_crags}</p>
              </div>
            )}

            {statistics.unique_cities > 0 && (
              <div className="stat-card">
                <div className="stat-header">
                  <p className="stat-label">Cities Explored</p>
                </div>
                <p className="stat-value">{statistics.unique_cities}</p>
              </div>
            )}

            {statistics.average_rating && (
              <div className="stat-card">
                <div className="stat-header">
                  <p className="stat-label">Avg Rating</p>
                </div>
                <p className="stat-value">{statistics.average_rating.toFixed(1)}</p>
                <p className="stat-subtext">({statistics.rated_problems_count} rated)</p>
              </div>
            )}

            {statistics.climbing_span_years && (
              <div className="stat-card">
                <div className="stat-header">
                  <p className="stat-label">Years Climbing</p>
                </div>
                <p className="stat-value">{statistics.climbing_span_years}</p>
              </div>
            )}

            {statistics.avg_ticks_per_year && (
              <div className="stat-card">
                <div className="stat-header">
                  <p className="stat-label">Avg Ticks/Year</p>
                </div>
                <p className="stat-value">{statistics.avg_ticks_per_year}</p>
              </div>
            )}

            {statistics.first_send && (
              <div className="stat-card">
                <div className="stat-header">
                  <p className="stat-label">First Send</p>
                </div>
                <p className="stat-value-small">
                  {new Date(statistics.first_send).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            )}

            {statistics.most_climbed_crag && (
              <div className="stat-card">
                <div className="stat-header">
                  <p className="stat-label">Most Climbed Crag</p>
                </div>
                <p className="stat-value-small">
                  <Link to={`/crags/${statistics.most_climbed_crag.id}`} className="stat-link">
                    {statistics.most_climbed_crag.name}
                  </Link>
                </p>
                <p className="stat-subtext">{statistics.most_climbed_crag.tick_count} ascents</p>
              </div>
            )}

            {statistics.most_climbed_city && (
              <div className="stat-card">
                <div className="stat-header">
                  <p className="stat-label">Most Climbed City</p>
                </div>
                <p className="stat-value-small">{statistics.most_climbed_city.name}</p>
                <p className="stat-subtext">{statistics.most_climbed_city.tick_count} ascents</p>
              </div>
            )}

            {statistics.most_active_year && (
              <div className="stat-card">
                <div className="stat-header">
                  <p className="stat-label">Most Active Year</p>
                </div>
                <p className="stat-value-small">{statistics.most_active_year.year}</p>
                <p className="stat-subtext">{statistics.most_active_year.tick_count} ascents</p>
              </div>
            )}

            {statistics.most_active_month && (
              <div className="stat-card">
                <div className="stat-header">
                  <p className="stat-label">Most Active Month</p>
                </div>
                <p className="stat-value-small">{statistics.most_active_month.month_name}</p>
                <p className="stat-subtext">{statistics.most_active_month.tick_count} ascents</p>
              </div>
            )}
          </div>

          {/* Charts Section */}
          {(statistics.grade_distribution && Object.keys(statistics.grade_distribution).length > 0) ||
          (statistics.ticks_per_year && Object.keys(statistics.ticks_per_year).length > 0) ? (
            <div className="charts-container">
              {/* Grade Distribution Chart */}
              {statistics.grade_distribution && Object.keys(statistics.grade_distribution).length > 0 && (
                <div className="chart-card">
                  <h3 className="chart-title">Grade Distribution</h3>
                  <div className="grade-distribution-chart">
                    {Object.entries(statistics.grade_distribution)
                      .filter(([_, count]) => count > 0)
                      .map(([grade, count]) => {
                        const maxCount = Math.max(...Object.values(statistics.grade_distribution).filter(c => c > 0));
                        const heightPercentage = (count / maxCount) * 100;
                        const percentage = (count / statistics.total_ticks) * 100;
                        return (
                          <div 
                            key={grade} 
                            className="grade-dist-item" 
                            title={`${count} ascents (${percentage.toFixed(1)}%)`}
                          >
                            <div className="grade-dist-bar-container">
                              <div 
                                className="grade-dist-bar" 
                                style={{ height: `${heightPercentage}%` }}
                              />
                            </div>
                            <div className="grade-dist-label">
                              <span className="grade-dist-grade">{grade}</span>
                              <span className="grade-dist-count">{count}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Activity by Year Chart */}
              {statistics.ticks_per_year && Object.keys(statistics.ticks_per_year).length > 0 && (
                <div className="chart-card">
                  <h3 className="chart-title">Activity by Year</h3>
                  <div className="year-activity-chart">
                    {Object.entries(statistics.ticks_per_year)
                      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                      .map(([year, count]) => {
                        const maxCount = Math.max(...Object.values(statistics.ticks_per_year));
                        const heightPercentage = (count / maxCount) * 100;
                        return (
                          <div 
                            key={year} 
                            className="year-activity-item" 
                            title={`${count} ascents in ${year}`}
                          >
                            <div className="year-activity-bar-container">
                              <div 
                                className="year-activity-bar" 
                                style={{ height: `${heightPercentage}%` }}
                              />
                            </div>
                            <div className="year-activity-label">
                              <span className="year-activity-year">{year}</span>
                              <span className="year-activity-count">{count}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button
          className={`tab-button ${activeTab === 'ticks' ? 'active' : ''}`}
          onClick={() => setActiveTab('ticks')}
        >
          <span className="material-symbols-outlined">history</span>
          My Tick List
          {ticks.length > 0 && (
            <span className="tab-badge">{ticks.length}</span>
          )}
        </button>
        <button
          className={`tab-button ${activeTab === 'lists' ? 'active' : ''}`}
          onClick={() => setActiveTab('lists')}
        >
          <span className="material-symbols-outlined">format_list_bulleted</span>
          Personal Lists & Projects
        </button>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'ticks' ? (
        <>
          {/* Search and Filters */}
          <div className="dashboard-toolbar">
            <div className="search-container">
              <span className="material-symbols-outlined search-icon">search</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search climbs, crags..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="filters-container">
              <div className="filter-dropdown-wrapper" ref={gradeFilterRef}>
                <button 
                  className={`filter-button ${gradeFilter !== 'all' ? 'active' : ''} ${showGradeDropdown ? 'open' : ''}`}
                  onClick={() => {
                    setShowGradeDropdown(!showGradeDropdown);
                    setShowStyleDropdown(false);
                  }}
                >
                  Grade: {gradeFilter === 'all' ? 'All' : gradeFilter}
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
                      All ({ticks.length})
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
                        {grade} ({availableGrades.counts[grade] || 0})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="filter-dropdown-wrapper" ref={styleFilterRef}>
                <button 
                  className={`filter-button ${styleFilter !== 'all' ? 'active' : ''} ${showStyleDropdown ? 'open' : ''}`}
                  onClick={() => {
                    setShowStyleDropdown(!showStyleDropdown);
                    setShowGradeDropdown(false);
                  }}
                >
                  Style: {styleFilter === 'all' ? 'All' : styleFilter.charAt(0).toUpperCase() + styleFilter.slice(1)}
                  <span className="material-symbols-outlined">expand_more</span>
                </button>
                {showStyleDropdown && (
                  <div className="filter-dropdown">
                    <button
                      className={`filter-dropdown-option ${styleFilter === 'all' ? 'active' : ''}`}
                      onClick={() => {
                        setStyleFilter('all');
                        setShowStyleDropdown(false);
                        setCurrentPage(1);
                      }}
                    >
                      All ({ticks.length})
                    </button>
                    {STYLE_CHOICES.map((style) => {
                      const count = ticks.filter(tick => getTickStyle(tick) === style).length;
                      return (
                        <button
                          key={style}
                          className={`filter-dropdown-option ${styleFilter === style ? 'active' : ''}`}
                          onClick={() => {
                            setStyleFilter(styleFilter === style ? 'all' : style);
                            setShowStyleDropdown(false);
                            setCurrentPage(1);
                          }}
                        >
                          {style.charAt(0).toUpperCase() + style.slice(1)} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="filter-divider"></div>
              <button className="view-toggle">
                <span className="material-symbols-outlined">grid_view</span>
              </button>
              <button className="view-toggle active">
                <span className="material-symbols-outlined">table_rows</span>
              </button>
            </div>
          </div>

          {/* Table */}
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
                        <th>Crag / Area</th>
                        <th>Date</th>
                        <th>Style</th>
                        <th className="actions-column"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTicks.map((tick) => (
                        <tr key={tick.id}>
                          <td className="grade-cell">{tick.problem.grade}</td>
                          <td className="route-cell">
                            <div className="route-cell-content">
                              <Link to={`/problems/${tick.problem.id}`} className="route-link">
                                {tick.problem.name}
                              </Link>
                              {tick.rating && (
                                <span className="route-rating">
                                  <StarRating rating={parseFloat(tick.rating)} size="small" />
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="crag-cell">
                            {tick.problem.crag ? (
                              <Link to={`/crags/${tick.problem.crag.id}`}>
                                {tick.problem.crag.name}
                              </Link>
                            ) : (
                              '-'
                            )}
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
                          <td className="actions-cell">
                            <button
                              className="action-button"
                              onClick={() => handleEdit(tick)}
                              title="Edit"
                            >
                              <span className="material-symbols-outlined">more_vert</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <div className="pagination-info">
                      Showing <span>{startIndex + 1}</span> to{' '}
                      <span>{Math.min(startIndex + itemsPerPage, filteredTicks.length)}</span> of{' '}
                      <span>{filteredTicks.length}</span> results
                    </div>
                    <div className="pagination-compact">
                      <button
                        className="pagination-compact-button"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        aria-label="Previous page"
                      >
                        <span className="material-symbols-outlined">chevron_left</span>
                      </button>
                      
                      {(() => {
                        // Always show 7 page slots for consistent size
                        const slots = [];
                        
                        if (currentPage <= 3) {
                          // Show: 1 2 3 4 5 ... last
                          for (let i = 1; i <= 5 && i <= totalPages; i++) {
                            slots.push(
                              <button
                                key={i}
                                className={`pagination-compact-page ${currentPage === i ? 'active' : ''}`}
                                onClick={() => setCurrentPage(i)}
                              >
                                {i}
                              </button>
                            );
                          }
                          if (totalPages > 5) {
                            slots.push(<span key="ellipsis1" className="pagination-compact-ellipsis">...</span>);
                            slots.push(
                              <button
                                key={totalPages}
                                className={`pagination-compact-page ${currentPage === totalPages ? 'active' : ''}`}
                                onClick={() => setCurrentPage(totalPages)}
                              >
                                {totalPages}
                              </button>
                            );
                          }
                        } else if (currentPage >= totalPages - 2) {
                          // Show: 1 ... last-4 last-3 last-2 last-1 last
                          slots.push(
                            <button
                              key={1}
                              className={`pagination-compact-page ${currentPage === 1 ? 'active' : ''}`}
                              onClick={() => setCurrentPage(1)}
                            >
                              1
                            </button>
                          );
                          if (totalPages > 5) {
                            slots.push(<span key="ellipsis1" className="pagination-compact-ellipsis">...</span>);
                            const start = Math.max(totalPages - 4, 2);
                            for (let i = start; i <= totalPages; i++) {
                              slots.push(
                                <button
                                  key={i}
                                  className={`pagination-compact-page ${currentPage === i ? 'active' : ''}`}
                                  onClick={() => setCurrentPage(i)}
                                >
                                  {i}
                                </button>
                              );
                            }
                          }
                        } else {
                          // Show: 1 ... current-1 current current+1 ... last
                          slots.push(
                            <button
                              key={1}
                              className={`pagination-compact-page ${currentPage === 1 ? 'active' : ''}`}
                              onClick={() => setCurrentPage(1)}
                            >
                              1
                            </button>
                          );
                          slots.push(<span key="ellipsis1" className="pagination-compact-ellipsis">...</span>);
                          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                            slots.push(
                              <button
                                key={i}
                                className={`pagination-compact-page ${currentPage === i ? 'active' : ''}`}
                                onClick={() => setCurrentPage(i)}
                              >
                                {i}
                              </button>
                            );
                          }
                          slots.push(<span key="ellipsis2" className="pagination-compact-ellipsis">...</span>);
                          slots.push(
                            <button
                              key={totalPages}
                              className={`pagination-compact-page ${currentPage === totalPages ? 'active' : ''}`}
                              onClick={() => setCurrentPage(totalPages)}
                            >
                              {totalPages}
                            </button>
                          );
                        }
                        
                        return slots;
                      })()}
                      
                      <button
                        className="pagination-compact-button"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        aria-label="Next page"
                      >
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <div className="lists-content">
          {listsLoading ? (
            <div className="loading">Loading your lists...</div>
          ) : lists.length === 0 ? (
            <div className="empty-state">
              <p>You haven&apos;t created any lists yet.</p>
              <button 
                className="btn-primary"
                onClick={() => {
                  // TODO: Implement create list functionality
                  alert('Create list functionality coming soon!');
                }}
              >
                Create New List
              </button>
            </div>
          ) : (
            <div className="recent-lists-grid">
              {lists.slice(0, 3).map((list) => (
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
            <button 
              className="list-card list-card-new"
              onClick={() => {
                // TODO: Implement create list functionality
                alert('Create list functionality coming soon!');
              }}
            >
              <div className="list-card-content">
                <span className="material-symbols-outlined">add</span>
                <p>Create New List</p>
              </div>
            </button>
            </div>
          )}
        </div>
      )}

      {/* Recent Lists Section (only show on ticks tab) */}
      {activeTab === 'ticks' && !listsLoading && lists.length > 0 && (
        <div className="recent-lists-section">
          <h3 className="section-title">
            <span className="material-symbols-outlined">bookmark</span>
            Recent Lists
          </h3>
          <div className="recent-lists-grid">
            {lists.slice(0, 3).map((list) => (
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
            <button 
              className="list-card list-card-new"
              onClick={() => {
                // TODO: Implement create list functionality
                alert('Create list functionality coming soon!');
              }}
            >
              <div className="list-card-content">
                <span className="material-symbols-outlined">add</span>
                <p>Create New List</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Edit Tick Modal */}
      {showEditModal && editingTick && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Tick - {editingTick.problem.name}</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
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
                  {['3', '3+', '4', '4+', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+', '7A', '7A+', '7B', '7B+', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A', '9A+'].map(
                    (grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    )
                  )}
                </select>
                <small>If you used easier beta, select the grade you actually climbed. This will be used for your statistics.</small>
              </div>
              <div className="form-group">
                <label htmlFor="edit-suggested-grade">Suggested Grade (Optional):</label>
                <select
                  id="edit-suggested-grade"
                  value={tickFormData.suggested_grade}
                  onChange={(e) => setTickFormData({ ...tickFormData, suggested_grade: e.target.value })}
                >
                  <option value="">No grade suggestion</option>
                  {['3', '3+', '4', '4+', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+', '7A', '7A+', '7B', '7B+', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A', '9A+'].map(
                    (grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    )
                  )}
                </select>
                <small>Help the community by suggesting what grade you think this problem is</small>
              </div>
              <div className="form-group">
                <label htmlFor="edit-tick-rating">Rate this Problem (Optional):</label>
                <StarRating
                  rating={tickFormData.rating || 0}
                  onChange={(rating) => setTickFormData({ ...tickFormData, rating: rating })}
                  editable={true}
                  size="medium"
                />
                <small>Rate this problem from 1 to 5 stars based on your experience</small>
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
                        setShowEditModal(false);
                        setEditingTick(null);
                        fetchTicks();
                        fetchStatistics();
                      } catch (err) {
                        console.error('❌ Failed to delete tick:', err);
                        alert('Failed to delete tick. Please try again.');
                      }
                    }
                  }}
                >
                  Delete Tick
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
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

export default MyTicks;
