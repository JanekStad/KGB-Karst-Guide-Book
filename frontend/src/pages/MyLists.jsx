import { useAuth } from '../contexts/AuthContext';
import './MyLists.css';

const MyLists = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="my-lists-page">
        <div className="error">Please log in to view your lists.</div>
      </div>
    );
  }

  return (
    <div className="my-lists-page">
      <h1>My Lists</h1>
      <p className="coming-soon">This feature is coming soon!</p>
      <p className="description">
        You&apos;ll be able to create and manage custom lists of boulder problems here.
      </p>
    </div>
  );
};

export default MyLists;

