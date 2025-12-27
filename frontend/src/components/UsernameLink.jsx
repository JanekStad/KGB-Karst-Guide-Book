import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './UsernameLink.css';

const UsernameLink = ({ username, userId, className = '' }) => {
  const { isAuthenticated } = useAuth();

  // Only make clickable if user is logged in
  if (!isAuthenticated || !userId) {
    return <span className={`username-text ${className}`}>{username || 'Anonymous'}</span>;
  }

  return (
    <Link 
      to={`/user/${userId}`} 
      className={`username-link ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {username || 'Anonymous'}
    </Link>
  );
};

export default UsernameLink;

