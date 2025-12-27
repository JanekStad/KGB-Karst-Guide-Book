import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Header.css';

const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const dropdownRef = useRef(null);

  console.log('🔝 Header rendering:', { isAuthenticated, user: user?.username });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  const handleLogout = () => {
    console.log('🚪 Logging out...');
    setShowProfileDropdown(false);
    logout();
    navigate('/');
  };

  const handleProfileClick = () => {
    setShowProfileDropdown(!showProfileDropdown);
  };

  const handleProfileLinkClick = () => {
    setShowProfileDropdown(false);
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

  // Check if current route is active
  const isActiveRoute = (path) => {
    return location.pathname === path;
  };

  return (
    <header className="header">
      <div className="header-container">
        <div className="header-left">
          {/* Logo */}
          <Link to="/" className="logo">
            <div className="logo-icon">
              <span className="material-symbols-outlined">landscape</span>
            </div>
            <span className="logo-text">BoulderDB</span>
          </Link>

          {/* Desktop Search - Only for logged out */}
          {!isAuthenticated && (
            <div className="header-search">
              <span className="material-symbols-outlined search-icon">search</span>
              <input 
                className="search-input" 
                type="text" 
                placeholder="Search crags or problems..." 
              />
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="header-right">
          {isAuthenticated ? (
            <>
              {/* Desktop Navigation */}
              <nav className="header-nav">
                <Link 
                  to="/" 
                  className={`nav-link ${isActiveRoute('/') ? 'active' : ''}`}
                >
                  Dashboard
                </Link>
                <Link 
                  to="/explore" 
                  className={`nav-link ${isActiveRoute('/explore') || isActiveRoute('/areas') ? 'active' : ''}`}
                >
                  Explore
                </Link>
                <Link 
                  to="/my-ticks" 
                  className={`nav-link ${isActiveRoute('/my-ticks') ? 'active' : ''}`}
                >
                  Logbook
                </Link>
              </nav>

              {/* User Profile */}
              <div className="user-profile-container" ref={dropdownRef}>
                <div className="user-profile" onClick={handleProfileClick}>
                  <div className="user-avatar">
                    {getInitials(user?.username || user?.email || 'U')}
                  </div>
                  <span className="user-name">{user?.username || 'User'}</span>
                </div>
                {showProfileDropdown && (
                  <div className="user-profile-dropdown">
                    <Link 
                      to="/profile" 
                      className="dropdown-item"
                      onClick={handleProfileLinkClick}
                    >
                      <span className="material-symbols-outlined">person</span>
                      Profile
                    </Link>
                    <Link 
                      to="/my-lists" 
                      className="dropdown-item"
                      onClick={handleProfileLinkClick}
                    >
                      <span className="material-symbols-outlined">list</span>
                      My Lists
                    </Link>
                    <button 
                      className="dropdown-item"
                      onClick={handleLogout}
                    >
                      <span className="material-symbols-outlined">logout</span>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Desktop Navigation */}
              <nav className="header-nav">
                <Link to="/explore" className="nav-link">Explore</Link>
                <Link to="/explore" className="nav-link">Crags</Link>
                <Link to="/explore" className="nav-link">Community</Link>
              </nav>

              {/* Auth Buttons */}
              <div className="auth-buttons">
                <Link to="/login" className="btn-login">
                  Log In
                </Link>
                <Link to="/register" className="btn-signup">
                  Sign Up
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
