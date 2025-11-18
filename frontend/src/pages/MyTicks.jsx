import { useAuth } from '../contexts/AuthContext';
import './MyTicks.css';

const MyTicks = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return (
      <div className="my-ticks-page">
        <div className="error">Please log in to view your ticks.</div>
      </div>
    );
  }

  return (
    <div className="my-ticks-page">
      <h1>My Ticks</h1>
      <p className="coming-soon">This feature is coming soon!</p>
      <p className="description">
        You'll be able to view all the boulder problems you've completed (ticked) here.
      </p>
    </div>
  );
};

export default MyTicks;

