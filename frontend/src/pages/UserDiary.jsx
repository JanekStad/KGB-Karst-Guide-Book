import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ticksAPI, usersAPI } from '../services/api';
import StarRating from '../components/StarRating';
import './UserDiary.css';

const UserDiary = () => {
  const { userId } = useParams();
  const [ticks, setTicks] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUserDiary();
  }, [userId]);

  const fetchUserDiary = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch user info
      const userResponse = await usersAPI.get(userId);
      setUser(userResponse.data);
      
      // Fetch user's ticks
      const ticksResponse = await ticksAPI.getUserDiary(userId);
      setTicks(ticksResponse.data || []);
    } catch (err) {
      console.error('Failed to fetch user diary:', err);
      setError('Failed to load user diary. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (loading) {
    return (
      <div className="user-diary-page">
        <div className="loading">Loading user diary...</div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="user-diary-page">
        <div className="error">{error || 'User not found'}</div>
      </div>
    );
  }

  return (
    <div className="user-diary-page">
      <div className="user-diary-container">
        <div className="user-diary-header">
          <h1>{user.username}'s Diary</h1>
          <p className="subtitle">
            {ticks.length === 0 
              ? 'No ticks yet' 
              : `${ticks.length} completed boulder problem${ticks.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>

        {ticks.length === 0 ? (
          <div className="empty-state">
            <p>This user hasn't ticked any boulder problems yet.</p>
          </div>
        ) : (
          <div className="ticks-list">
            {ticks.map((tick) => (
              <div key={tick.id} className="tick-item">
                <div className="tick-main">
                  <div className="tick-problem">
                    <Link to={`/problems/${tick.problem.id}`} className="problem-name">
                      {tick.problem.name}
                    </Link>
                    <div className="tick-grades">
                      {tick.tick_grade && tick.tick_grade !== tick.problem.grade ? (
                        <>
                          <span className="tick-grade" title="Grade they climbed">
                            {tick.tick_grade}
                          </span>
                          <span className="grade-separator">/</span>
                          <span className="problem-grade" title="Problem grade">
                            {tick.problem.grade}
                          </span>
                        </>
                      ) : (
                        <span className="problem-grade">{tick.problem.grade}</span>
                      )}
                    </div>
                  </div>
                  <div className="tick-meta">
                    <span className="tick-date">{formatDate(tick.date)}</span>
                    {tick.problem.area && (
                      <Link to={`/crags/${tick.problem.area.id}`} className="tick-crag">
                        {tick.problem.area.name}
                      </Link>
                    )}
                    {tick.rating && (
                      <div className="tick-rating">
                        <StarRating rating={parseFloat(tick.rating)} size="small" />
                      </div>
                    )}
                  </div>
                  {tick.notes && (
                    <div className="tick-notes">{tick.notes}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDiary;

