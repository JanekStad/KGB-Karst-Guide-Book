import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Home.css';

const Home = () => {
  const { isAuthenticated } = useAuth();
  
  console.log('🏠 Home page rendering:', { isAuthenticated });

  return (
    <div className="home">
      <div className="hero">
        <h1>Welcome to Karst Guide Book</h1>
        <p className="subtitle">Your local boulder problems database</p>
        <div className="hero-actions">
          <Link to="/crags" className="btn btn-primary">
            Explore Crags
          </Link>
        </div>
      </div>

      <div className="features">
        <div className="feature">
          <h3>🗺️ Interactive Maps</h3>
          <p>Find boulder positions on interactive maps</p>
        </div>
        <div className="feature">
          <h3>📸 Photo Gallery</h3>
          <p>View photos of boulders and problems</p>
        </div>
        <div className="feature">
          <h3>✅ Track Your Progress</h3>
          <p>Tick problems and create custom lists</p>
        </div>
        <div className="feature">
          <h3>💬 Community</h3>
          <p>Comment and share your experiences</p>
        </div>
      </div>
    </div>
  );
};

export default Home;

