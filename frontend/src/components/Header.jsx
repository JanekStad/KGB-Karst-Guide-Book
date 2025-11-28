import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Header.css';

const Header = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  console.log('🔝 Header rendering:', { isAuthenticated, user: user?.username });

  const handleLogout = () => {
    console.log('🚪 Logging out...');
    logout();
    navigate('/');
  };

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <h1>I B W T</h1>
        </Link>
        <nav className="nav">
          <Link to="/explore">Explore</Link>
          {isAuthenticated ? (
            <>
              <Link to="/problems/add">Add Problem</Link>
              <Link to="/my-ticks">My Ticks</Link>
              <Link to="/my-lists">My Lists</Link>
              <Link to="/profile">{user?.username}</Link>
              <button onClick={handleLogout} className="btn-logout">
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;

