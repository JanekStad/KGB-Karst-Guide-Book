import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@apollo/client/react';
import { useAuth } from '../contexts/AuthContext';
import { problemsAPI, ticksAPI } from '../services/api';
import { UNIVERSAL_SEARCH } from '../services/graphql/queries';
import UsernameLink from '../components/UsernameLink';
import SearchResults from '../components/SearchResults';
import './Home.css';

const Home = () => {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [trendingProblems, setTrendingProblems] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [userTicks, setUserTicks] = useState([]);
  const [userProjects, _setUserProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (!authLoading) {
      fetchData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  // Debounce search query
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // GraphQL search query
  const { data: searchData, loading: searchLoading } = useQuery(UNIVERSAL_SEARCH, {
    variables: { query: debouncedSearchQuery },
    skip: !debouncedSearchQuery || debouncedSearchQuery.length < 2,
  });

  // Show search results when data arrives or when query is ready
  useEffect(() => {
    // Show results if we have a valid query (2+ chars in either current or debounced)
    const hasValidQuery = (searchQuery.length >= 2) || (debouncedSearchQuery && debouncedSearchQuery.length >= 2);
    
    if (hasValidQuery) {
      // Always show results when we have a valid query
      // This triggers when:
      // 1. User types (searchQuery changes)
      // 2. Debounce completes (debouncedSearchQuery changes)
      // 3. Data arrives (searchData changes)
      setShowSearchResults(true);
    } else {
      // Hide if query is too short
      setShowSearchResults(false);
    }
  }, [debouncedSearchQuery, searchData, searchQuery]);

  // Explicitly show results when search data arrives (even if query hasn't debounced yet)
  useEffect(() => {
    if (searchData?.search !== undefined && searchQuery.length >= 2) {
      setShowSearchResults(true);
    }
  }, [searchData, searchQuery]);

  // Handle search input changes
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value;
    setSearchQuery(value);
    // Ensure input is considered focused when user is typing
    if (document.activeElement === e.target) {
      setIsSearchFocused(true);
    }
    // Immediately show results when user types (if query is long enough)
    // This provides instant feedback even before debounce completes
    if (value.length >= 2) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  }, []);

  // Handle search input focus
  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
    // Show results if we already have a query
    if (searchQuery.length >= 2) {
      setShowSearchResults(true);
    }
  }, [searchQuery]);

  // Handle search input blur
  const handleSearchBlur = useCallback(() => {
    // Delay blur to allow clicks on search results to process
    setTimeout(() => {
      // Check if focus moved to search results
      const activeElement = document.activeElement;
      if (!activeElement || !activeElement.closest('.search-results')) {
        setIsSearchFocused(false);
      }
    }, 200);
  }, []);

  // Handle closing search results
  const handleCloseSearch = useCallback(() => {
    setShowSearchResults(false);
    setIsSearchFocused(false);
    setSearchQuery('');
    if (searchInputRef.current) {
      searchInputRef.current.blur();
    }
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K or Ctrl+K to focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
      // Escape to close search
      if (e.key === 'Escape' && showSearchResults) {
        handleCloseSearch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearchResults, handleCloseSearch]);

  // Handle click outside to close search results
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        showSearchResults &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target) &&
        !e.target.closest('.search-results') &&
        !e.target.closest('.welcome-search')
      ) {
        setShowSearchResults(false);
        setIsSearchFocused(false);
      }
    };

    if (showSearchResults) {
      // Use a small delay to allow click events on search results to process first
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showSearchResults]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch trending problems (for both logged in and out)
      const problemsResponse = await problemsAPI.list({ page_size: 20 });
      const problems = problemsResponse.data.results || problemsResponse.data;
      const sortedProblems = problems
        .sort((a, b) => (b.tick_count || 0) - (a.tick_count || 0))
        .slice(0, 4);
      setTrendingProblems(sortedProblems);

      if (isAuthenticated) {
        // Fetch user-specific data
        try {
          const ticksResponse = await ticksAPI.list();
          const ticks = ticksResponse.data.results || ticksResponse.data;
          setUserTicks(ticks.slice(0, 5));
          
          // Get recent activity (could be from all users or just user's activity)
          // For now, using user's ticks as activity
          setRecentActivity(ticks.slice(0, 10));
        } catch (err) {
          console.error('Failed to fetch user data:', err);
        }
      } else {
        // For logged-out users, try to get recent activity from all users
        // This might need a different endpoint
        setRecentActivity([]);
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
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

  if (authLoading || loading) {
    return (
      <div className="home" data-theme="dark">
        <div className="loading-container">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Logged-in Dashboard Layout
  if (isAuthenticated) {
    const sendsThisMonth = userTicks.filter(tick => {
      const tickDate = new Date(tick.date || tick.created_at);
      const now = new Date();
      return tickDate.getMonth() === now.getMonth() && 
             tickDate.getFullYear() === now.getFullYear();
    }).length;

    return (
      <div className="home home-dashboard" data-theme="dark">
        {/* Welcome Section */}
        <section className="welcome-section">
          <div className="welcome-background"></div>
          <div className="welcome-content">
            <div className="welcome-text">
              <p className="greeting">
                <span className="material-symbols-outlined">wb_sunny</span>
                {getGreeting()}
              </p>
              <h1>Welcome back, {user?.username || 'Climber'}</h1>
              <div className="welcome-search">
                <span className="material-symbols-outlined search-icon">search</span>
                <input 
                  ref={searchInputRef}
                  type="text" 
                  placeholder="Search for problems, crags, sectors, or users..." 
                  className="search-input"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={handleSearchFocus}
                  onBlur={handleSearchBlur}
                />
                <kbd className="search-shortcut">Cmd+K</kbd>
                {showSearchResults && (
                  <SearchResults
                    results={searchData?.search}
                    query={debouncedSearchQuery || searchQuery}
                    onClose={handleCloseSearch}
                    anchorElement={searchInputRef.current}
                  />
                )}
              </div>
            </div>
            <div className="welcome-stats">
              <div className="stat-card">
                <span className="stat-value">{sendsThisMonth}</span>
                <span className="stat-label">Sends This Mo.</span>
              </div>
              <div className="stat-card">
                <span className="stat-value stat-primary">{userProjects.length}</span>
                <span className="stat-label">Active Projects</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">Top 5%</span>
                <span className="stat-label">Local Rank</span>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="dashboard-main">
          <div className="dashboard-container">
            <div className="dashboard-left">
              {/* Recent Activity */}
              <div className="activity-section">
                <div className="section-header">
                  <h3>
                    <span className="material-symbols-outlined">rss_feed</span>
                    Recent Activity
                  </h3>
                  <div className="filter-buttons">
                    <button className="filter-btn active">All</button>
                    <button className="filter-btn">Following</button>
                    <button className="filter-btn">Local Area</button>
                  </div>
                </div>
                <div className="activity-list">
                  {recentActivity.length > 0 ? (
                    recentActivity.map((activity, idx) => (
                      <div key={activity.id || idx} className="activity-item">
                        <div className="activity-avatar">
                          {getInitials(activity.user?.username || 'U')}
                        </div>
                        <div className="activity-content">
                          <p>
                            <strong>
                              <UsernameLink 
                                username={activity.user?.username || 'Someone'} 
                                userId={activity.user?.id}
                              />
                            </strong> logged an ascent of{' '}
                            <Link to={`/problems/${activity.problem?.id || activity.problem}`} className="activity-link">
                              {activity.problem?.name || 'Unknown Problem'}
                            </Link>
                          </p>
                          <p className="activity-meta">
                            {formatTimeAgo(activity.date || activity.created_at)} • {activity.problem?.area_name || ''}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">No recent activity</div>
                  )}
                </div>
                <button className="load-more-btn">Load more activity</button>
              </div>
            </div>

            <div className="dashboard-right">
              {/* Quick Actions */}
              <div className="quick-actions">
                <Link to="/problems/add" className="action-btn primary">
                  <span className="material-symbols-outlined">add_circle</span>
                  <span>Log Ascent</span>
                </Link>
                <Link to="/explore" className="action-btn">
                  <span className="material-symbols-outlined">map</span>
                  <span>Find Crag</span>
                </Link>
              </div>

              {/* My Projects */}
              <div className="projects-card">
                <div className="card-header">
                  <h3>My Projects</h3>
                  <Link to="/my-lists" className="view-all-link">View All</Link>
                </div>
                <div className="projects-list">
                  {userProjects.length > 0 ? (
                    userProjects.map((project, idx) => (
                      <div key={project.id || idx} className="project-item">
                        <div className="project-image"></div>
                        <div className="project-info">
                          <p className="project-name">{project.name || 'Project'}</p>
                          <p className="project-meta">{project.area || 'Area'} • {project.grade || 'V?'}</p>
                        </div>
                        <div className="project-checkbox"></div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">No active projects</div>
                  )}
                </div>
              </div>

              {/* Conditions */}
              <div className="conditions-card">
                <div className="card-header">
                  <h3>
                    <span className="material-symbols-outlined">thermostat</span>
                    Conditions
                  </h3>
                  <span className="conditions-location">Bishop, CA</span>
                </div>
                <div className="conditions-list">
                  <div className="condition-item">
                    <div className="condition-info">
                      <span className="material-symbols-outlined condition-icon">sunny</span>
                      <div>
                        <p className="condition-name">Happy Boulders</p>
                        <p className="condition-meta">Dry • 65°F</p>
                      </div>
                    </div>
                    <span className="condition-badge prime">Prime</span>
                  </div>
                  <div className="condition-item">
                    <div className="condition-info">
                      <span className="material-symbols-outlined condition-icon">cloud</span>
                      <div>
                        <p className="condition-name">Buttermilks</p>
                        <p className="condition-meta">Windy • 52°F</p>
                      </div>
                    </div>
                    <span className="condition-badge fair">Fair</span>
                  </div>
                </div>
              </div>

              {/* Recommended */}
              <div className="recommended-card">
                <h3>Recommended for You</h3>
                <p className="recommended-subtitle">Based on your recent sends.</p>
                {trendingProblems.length > 0 && (
                  <div className="recommended-item">
                    <div className="recommended-image"></div>
                    <div>
                      <p className="recommended-name">{trendingProblems[0].name}</p>
                      <p className="recommended-meta">{trendingProblems[0].grade} • Nearby</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // Logged-out Landing Page Layout
  return (
    <div className="home home-landing" data-theme="dark">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-background">
          <div className="hero-overlay"></div>
        </div>
        <div className="hero-content">
          <h1>
            Track your climbs.<br />
            <span className="text-primary">Discover local crags.</span>
          </h1>
          <p className="hero-subtitle">
            Join the largest climbing community. Log your sends, find beta, and explore over 50,000 problems worldwide.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn-primary">
              Start Logging
            </Link>
            <Link to="/explore" className="btn-secondary">
              <span className="material-symbols-outlined">map</span>
              Find a Crag
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-container">
          <div className="stat-box">
            <span className="stat-number">10k+</span>
            <span className="stat-label">Active Climbers</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">50,000+</span>
            <span className="stat-label">Problems Logged</span>
          </div>
          <div className="stat-box">
            <span className="stat-number">500+</span>
            <span className="stat-label">Local Crags Mapped</span>
          </div>
        </div>
      </section>

      {/* Trending Classics Section */}
      <section className="trending-section">
        <div className="section-container">
          <div className="section-header">
            <div>
              <h2>Trending Classics</h2>
              <p className="section-subtitle">Popular problems climbers are crushing this week.</p>
            </div>
            <Link to="/problems" className="view-all-link">
              View all classics
              <span className="material-symbols-outlined">arrow_forward</span>
            </Link>
          </div>
          <div className="trending-grid">
            {trendingProblems.map((problem) => (
              <Link 
                key={problem.id} 
                to={`/problems/${problem.id}`}
                className="trending-card"
              >
                <div className="card-image">
                  <div className="grade-badge">{problem.grade || 'V?'}</div>
                </div>
                <div className="card-content">
                  <h3>{problem.name}</h3>
                  <p className="card-location">{problem.area_name || 'Unknown Area'}</p>
                  <div className="card-footer">
                    <div className="star-rating">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className="material-symbols-outlined filled">
                          star
                        </span>
                      ))}
                    </div>
                    <span className="ascent-count">{problem.tick_count || 0} ascents</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="section-container">
          <div className="features-content">
            <div className="features-text">
              <h2>Why Climbers Love Us</h2>
              <p>Everything you need to push your grades and find new projects, all in one place.</p>
              <div className="features-list">
                <div className="feature-item">
                  <div className="feature-icon">
                    <span className="material-symbols-outlined">edit_note</span>
                  </div>
                  <div>
                    <h3>Log Your Ascents</h3>
                    <p>Keep track of every send and project with our digital logbook. Visualize your progress over time.</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <span className="material-symbols-outlined">map</span>
                  </div>
                  <div>
                    <h3>Detailed Crag Maps</h3>
                    <p>Find the exact location of boulders with GPS coordinates and approach trail maps.</p>
                  </div>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">
                    <span className="material-symbols-outlined">groups</span>
                  </div>
                  <div>
                    <h3>Community Beta</h3>
                    <p>Get the latest beta, video links, and conditions reports from local climbers.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="features-visual">
              <div className="activity-feed-card">
                <div className="feed-header">
                  <h3>Live Activity</h3>
                  <div className="live-indicator">
                    <span className="pulse-dot"></span>
                    <span>LIVE</span>
                  </div>
                </div>
                <div className="feed-content">
                  {recentActivity.slice(0, 4).map((activity, idx) => (
                    <div key={activity.id || idx} className="feed-item">
                      <div className="feed-avatar"></div>
                      <div className="feed-text">
                        <p>
                          <strong>
                            <UsernameLink 
                              username={activity.user?.username || 'Someone'} 
                              userId={activity.user?.id}
                            />
                          </strong> sent{' '}
                          <span className="text-primary">{activity.problem?.name || 'a problem'}</span>
                        </p>
                        <p className="feed-time">{formatTimeAgo(activity.date || activity.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="feed-footer">
                  <button className="feed-link">View Full Feed</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="section-container">
          <div className="cta-card">
            <h2>Ready to crush?</h2>
            <p>Join thousands of climbers and start tracking your progression today.</p>
            <div className="cta-actions">
              <Link to="/register" className="btn-primary">Create Free Account</Link>
              <Link to="/problems" className="btn-secondary">Browse Problems</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
