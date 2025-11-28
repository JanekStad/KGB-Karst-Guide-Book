import CommunityStats from '../components/CommunityStats';
import NewProblemsCard from '../components/NewProblemsCard';
import RecentActivityFeed from '../components/RecentActivityFeed';
import TrendingProjectsCard from '../components/TrendingProjectsCard';
import './Home.css';

const Home = () => {
  console.log('🏠 Home page rendering');

  return (
    <div className="home" data-theme="dark">
      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-background">
          {/* Background image placeholder - replace with actual Moravsky kras boulder photo */}
          <div className="hero-image-placeholder"></div>
          {/* Dark Overlay Gradient - Critical for text contrast */}
          <div className="hero-overlay"></div>
        </div>
        
        {/* Hero Content - Centered */}
        <div className="hero-content">
          <h1 className="hero-title">
            Moravský Kras
            <br />
            Boulder Guide
          </h1>
          <p className="hero-subtitle">
            A community-maintained guide to bouldering in the region
          </p>
          
          {/* Hero Tables Section */}
          <div className="hero-tables">
            <RecentActivityFeed limit={5} />
            <CommunityStats />
          </div>
        </div>
      </header>

      {/* Dashboard Cards Section */}
      <section className="dashboard-section">
        <div className="dashboard-container">
          <NewProblemsCard />
          <TrendingProjectsCard />
        </div>
      </section>
    </div>
  );
};

export default Home;

