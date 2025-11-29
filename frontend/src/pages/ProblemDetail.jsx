import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import InteractiveBoulderImage from '../components/InteractiveBoulderImage';
import StarRating from '../components/StarRating';
import { useAuth } from '../contexts/AuthContext';
import { commentsAPI, problemsAPI, ticksAPI } from '../services/api';
import './ProblemDetail.css';

const ProblemDetail = () => {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const [problem, setProblem] = useState(null);
  const [comments, setComments] = useState([]);
  const [isTicked, setIsTicked] = useState(false);
  const [currentTick, setCurrentTick] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [showTickModal, setShowTickModal] = useState(false);
  const [problemTicks, setProblemTicks] = useState([]);
  const [loadingTicks, setLoadingTicks] = useState(false);
  const [tickFormData, setTickFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    notes: '',
    tick_grade: '',
    suggested_grade: '',
    rating: null,
  });

  useEffect(() => {
    fetchProblem();
    fetchComments();
    fetchStatistics();
    fetchProblemTicks();
  }, [id]);

  const checkTick = useCallback(async () => {
    if (!isAuthenticated) {
      console.log('⏭️ Skipping tick check - user not authenticated');
      setIsTicked(false);
      setCurrentTick(null);
      return;
    }
    try {
      console.log('📡 Checking tick status for problem ID:', id);
      const response = await ticksAPI.list();
      const ticks = response.data.results || response.data;
      // Tick.problem is a nested object, so we need to check problem.id
      const tick = ticks.find((tick) => {
        const problemId = tick.problem?.id || tick.problem;
        return problemId === parseInt(id);
      });
      if (tick) {
        setIsTicked(true);
        setCurrentTick(tick);
        console.log('✅ Tick found:', tick);
      } else {
        setIsTicked(false);
        setCurrentTick(null);
        console.log('✅ Not ticked');
      }
    } catch (err) {
      console.error('❌ Failed to check tick:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
      });
      setIsTicked(false);
      setCurrentTick(null);
    }
  }, [id, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated && id) {
      checkTick();
    } else {
      setIsTicked(false);
    }
  }, [id, isAuthenticated, checkTick]);

  const fetchProblem = async () => {
    try {
      console.log('📡 Fetching problem details for ID:', id);
      setLoading(true);
      const response = await problemsAPI.get(id);
      console.log('✅ Problem fetched successfully:', response.data);
      setProblem(response.data);
      setError(null);
    } catch (err) {
      console.error('❌ Failed to fetch problem:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        request: err.request,
        status: err.response?.status,
      });
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          'Failed to load problem details.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      console.log('📡 Fetching comments for problem ID:', id);
      const response = await commentsAPI.list({ problem: id });
      console.log('✅ Comments fetched successfully:', response.data);
      setComments(response.data.results || response.data);
    } catch (err) {
      console.error('❌ Failed to fetch comments:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
      });
    }
  };

  const fetchStatistics = async () => {
    try {
      console.log('📡 Fetching statistics for problem ID:', id);
      const response = await problemsAPI.getStatistics(id);
      console.log('✅ Statistics fetched successfully:', response.data);
      setStatistics(response.data);
    } catch (err) {
      console.error('❌ Failed to fetch statistics:', err);
    }
  };

  const fetchProblemTicks = async () => {
    try {
      console.log('📡 Fetching ticks for problem ID:', id);
      setLoadingTicks(true);
      const response = await ticksAPI.getProblemTicks(id);
      console.log('✅ Problem ticks fetched successfully:', response.data);
      setProblemTicks(response.data || []);
    } catch (err) {
      console.error('❌ Failed to fetch problem ticks:', err);
      setProblemTicks([]);
    } finally {
      setLoadingTicks(false);
    }
  };


  const handleTickSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Please login to tick problems');
      return;
    }

    try {
      if (isTicked && currentTick) {
        // Update existing tick - don't send problem field
        const payload = {
          date: tickFormData.date,
          notes: tickFormData.notes,
          tick_grade: tickFormData.tick_grade || null,
          suggested_grade: tickFormData.suggested_grade || null,
        };
        if (tickFormData.rating) {
          payload.rating = parseFloat(tickFormData.rating);
        }
        await ticksAPI.patch(currentTick.id, payload);
        console.log('✅ Tick updated');
      } else {
        // Create new tick
        const payload = {
          problem: parseInt(id),
          date: tickFormData.date,
          notes: tickFormData.notes,
        };
        if (tickFormData.tick_grade) {
          payload.tick_grade = tickFormData.tick_grade;
        }
        if (tickFormData.suggested_grade) {
          payload.suggested_grade = tickFormData.suggested_grade;
        }
        if (tickFormData.rating) {
          payload.rating = parseFloat(tickFormData.rating);
        }
        await ticksAPI.create(payload);
        console.log('✅ Tick created');
      }
      
      setShowTickModal(false);
      setTickFormData({
        date: new Date().toISOString().split('T')[0],
        notes: '',
        tick_grade: '',
        suggested_grade: '',
        rating: null,
      });
      await checkTick();
      fetchStatistics();
      fetchProblemTicks();
    } catch (err) {
      console.error('❌ Failed to save tick:', err);
      alert(`Failed to ${isTicked ? 'update' : 'create'} tick. Please try again.`);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      alert('Please login to comment');
      return;
    }

    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      await commentsAPI.create({
        problem: parseInt(id),
        content: newComment,
      });
      setNewComment('');
      fetchComments();
    } catch (err) {
      console.error('Failed to submit comment:', err);
      alert('Failed to submit comment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Helper function to extract video ID and create embed
  const getVideoEmbed = (url) => {
    if (!url) return null;

    // YouTube
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const youtubeMatch = url.match(youtubeRegex);
    if (youtubeMatch) {
      const videoId = youtubeMatch[1];
      return (
        <iframe
          width="100%"
          height="400"
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        ></iframe>
      );
    }

    // Vimeo
    const vimeoRegex = /(?:vimeo\.com\/)(\d+)/;
    const vimeoMatch = url.match(vimeoRegex);
    if (vimeoMatch) {
      const videoId = vimeoMatch[1];
      return (
        <iframe
          src={`https://player.vimeo.com/video/${videoId}`}
          width="100%"
          height="400"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        ></iframe>
      );
    }

    return null;
  };

  if (loading) {
    return (
      <div className="problem-detail-page">
        <div className="loading">Loading problem details...</div>
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="problem-detail-page">
        <div className="error">{error || 'Problem not found'}</div>
      </div>
    );
  }

  return (
    <div className="problem-detail-page">
      {(problem.area_detail || problem.area || problem.crag_detail || problem.crag) && (
        <Link
          to={`/areas/${(problem.area_detail || problem.area || problem.crag_detail || problem.crag)?.id || problem.area || problem.crag}`}
          className="back-link"
        >
          ← Back to Area
        </Link>
      )}

      <div className="problem-header">
        <div className="problem-title-section">
          <div className="problem-grade-large">{problem.grade}</div>
          <div>
            <h1>{problem.name}</h1>
            {(problem.area_detail || problem.area || problem.crag_detail || problem.crag) && (
              <p className="crag-link">
                At{' '}
                <Link to={`/areas/${(problem.area_detail || problem.area || problem.crag_detail || problem.crag)?.id || problem.area || problem.crag}`}>
                  {(problem.area_detail || problem.area || problem.crag_detail || problem.crag)?.name || `Area #${(problem.area_detail || problem.area || problem.crag_detail || problem.crag)?.id || problem.area || problem.crag}`}
                </Link>
                {(problem.wall_detail || problem.wall) && (
                  <span> - {(problem.wall_detail || problem.wall)?.name}</span>
                )}
              </p>
            )}
            <div className="problem-meta">
              {(problem.average_rating || problem.rating) && (
                <div className="problem-rating">
                  <StarRating 
                    rating={parseFloat(problem.average_rating || problem.rating)} 
                    size="small" 
                  />
                </div>
              )}
              {problem.author_username && (
                <div className="problem-author">
                  <span className="meta-label">Author:</span>
                  <span className="meta-value">{problem.author_username}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        {isAuthenticated && (
          <div className="problem-actions">
            {isTicked ? (
              <>
                <span className="tick-status">✓ Ticked</span>
                <button
                  onClick={() => {
                    if (currentTick) {
                      setTickFormData({
                        date: currentTick.date || new Date().toISOString().split('T')[0],
                        notes: currentTick.notes || '',
                        tick_grade: currentTick.tick_grade || '',
                        suggested_grade: currentTick.suggested_grade || '',
                        rating: currentTick.rating ? parseFloat(currentTick.rating) : null,
                      });
                      setShowTickModal(true);
                    }
                  }}
                  className="btn-edit"
                >
                  Edit
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  setTickFormData({
                    date: new Date().toISOString().split('T')[0],
                    notes: '',
                    tick_grade: '',
                    suggested_grade: '',
                    rating: null,
                  });
                  setShowTickModal(true);
                }}
                className="btn-tick"
              >
                + Tick
              </button>
            )}
          </div>
        )}
      </div>

      {problem.images && problem.images.length > 0 && (
        <div className="images-section">
          <h2>Images</h2>
          <div className="images-container">
            {problem.images.map((image) => (
              <InteractiveBoulderImage
                key={image.id}
                imageUrl={image.image}
                problemLines={image.problem_lines || []}
                caption={image.caption}
                currentProblemId={parseInt(id)}
              />
            ))}
          </div>
        </div>
      )}

      {problem.description && (
        <div className="problem-description">
          <h2>Description</h2>
          <p>{problem.description}</p>
        </div>
      )}

      {problem.video_links && problem.video_links.length > 0 && (
        <div className="videos-section">
          <h2>Videos</h2>
          <div className="videos-list">
            {problem.video_links.map((video, index) => (
              <div key={index} className="video-item">
                {getVideoEmbed(video.url) ? (
                  <div className="video-embed">
                    {getVideoEmbed(video.url)}
                  </div>
                ) : (
                  <a 
                    href={video.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="video-link"
                  >
                    <div className="video-link-content">
                      <span className="video-icon">▶️</span>
                      <div>
                        <strong>{video.label || 'Watch Video'}</strong>
                        <span className="video-url">{video.url}</span>
                      </div>
                    </div>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {problem.external_links && problem.external_links.length > 0 && (
        <div className="external-links-section">
          <h2>External Links</h2>
          <div className="external-links-list">
            {problem.external_links.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="external-link-item"
              >
                <span className="link-icon">🔗</span>
                <div className="link-content">
                  <strong>{link.label || 'External Link'}</strong>
                  <span className="link-url">
                    {(() => {
                      try {
                        return new URL(link.url).hostname;
                      } catch {
                        return link.url;
                      }
                    })()}
                  </span>
                </div>
                <span className="link-arrow">→</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {problemTicks.length > 0 && (
        <div className="ticks-section">
          <h2>Who Ticked This Problem ({problemTicks.length})</h2>
          <div className="ticks-table-container">
            <table className="ticks-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Date</th>
                  <th>Grade</th>
                  <th>Rating</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {problemTicks.map((tick) => (
                  <tr key={tick.id}>
                    <td>
                      <Link 
                        to={`/users/${tick.user?.id}/diary`}
                        className="user-link"
                      >
                        {tick.user?.username || 'Anonymous'}
                      </Link>
                    </td>
                    <td>{new Date(tick.date).toLocaleDateString()}</td>
                    <td>
                      {tick.tick_grade || tick.problem?.grade || '-'}
                    </td>
                    <td>
                      {tick.rating ? (
                        <StarRating 
                          rating={parseFloat(tick.rating)} 
                          size="small" 
                        />
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="tick-notes">
                      {tick.notes ? (
                        <span title={tick.notes}>
                          {tick.notes.length > 50 
                            ? `${tick.notes.substring(0, 50)}...` 
                            : tick.notes}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {statistics && (
        <div className="statistics-section">
          <h2>Statistics</h2>
          
          {statistics.height_data_count > 0 && (
            <div className="stat-group">
              <h3>Height Distribution</h3>
              <p className="stat-description">
                {statistics.height_data_count} of {statistics.total_ticks} climbers provided height data
              </p>
              <div className="height-chart">
                {Object.entries(statistics.height_distribution)
                  .sort((a, b) => {
                    // Sort by height category
                    const order = ['<150', '150-155', '155-160', '160-165', '165-170', '170-175', '175-180', '180-185', '185-190', '190-195', '>195'];
                    return order.indexOf(a[0]) - order.indexOf(b[0]);
                  })
                  .map(([height, data]) => {
                    const percentage = (data.count / statistics.height_data_count) * 100;
                    return (
                      <div key={height} className="height-bar-item">
                        <div className="height-label">{data.label}</div>
                        <div className="height-bar-container">
                          <div 
                            className="height-bar" 
                            style={{ width: `${percentage}%` }}
                            title={`${data.count} climber${data.count !== 1 ? 's' : ''}`}
                          >
                            <span className="height-count">{data.count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {statistics.grade_votes_count > 0 && (
            <div className="stat-group">
              <h3>Grade Voting</h3>
              <p className="stat-description">
                {statistics.grade_votes_count} of {statistics.total_ticks} climbers voted on the grade
              </p>
              <div className="grade-voting-chart">
                {Object.entries(statistics.grade_voting)
                  .sort((a, b) => {
                    // Sort by grade difficulty
                    const gradeOrder = ['3', '3+', '4', '4+', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+', '7A', '7A+', '7B', '7B+', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A', '9A+'];
                    return gradeOrder.indexOf(a[0]) - gradeOrder.indexOf(b[0]);
                  })
                  .map(([grade, data]) => {
                    const percentage = (data.count / statistics.grade_votes_count) * 100;
                    return (
                      <div key={grade} className="grade-vote-item">
                        <div className="grade-vote-label">{data.label}</div>
                        <div className="grade-vote-bar-container">
                          <div 
                            className="grade-vote-bar" 
                            style={{ width: `${percentage}%` }}
                            title={`${data.count} vote${data.count !== 1 ? 's' : ''}`}
                          >
                            <span className="grade-vote-count">{data.count}</span>
                          </div>
                        </div>
                        <div className="grade-vote-percentage">{percentage.toFixed(1)}%</div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {statistics.total_ticks === 0 && (
            <p className="no-statistics">No statistics available yet. Be the first to tick this problem!</p>
          )}
        </div>
      )}

      <div className="comments-section">
        <h2>Comments ({comments.length})</h2>
        {isAuthenticated ? (
          <form onSubmit={handleCommentSubmit} className="comment-form">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              rows="3"
              className="comment-input"
            />
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="btn btn-primary"
            >
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </form>
        ) : (
          <p className="login-prompt">
            <Link to="/login">Login</Link> to add comments
          </p>
        )}

        <div className="comments-list">
          {comments.length === 0 ? (
            <p className="no-comments">No comments yet. Be the first to comment!</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="comment">
                <div className="comment-header">
                  <strong>{comment.user?.username || 'Anonymous'}</strong>
                  <span className="comment-date">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="comment-content">{comment.content}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Tick Modal */}
      {showTickModal && (
        <div className="modal-overlay" onClick={() => setShowTickModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{isTicked ? 'Edit Tick' : 'Add Tick'}</h2>
              <button className="modal-close" onClick={() => setShowTickModal(false)}>×</button>
            </div>
            <form onSubmit={handleTickSubmit} className="tick-form">
              <div className="form-group">
                <label htmlFor="tick-date">Date:</label>
                <input
                  type="date"
                  id="tick-date"
                  value={tickFormData.date}
                  onChange={(e) => setTickFormData({ ...tickFormData, date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="tick-grade">Grade You Climbed (Optional):</label>
                <select
                  id="tick-grade"
                  value={tickFormData.tick_grade}
                  onChange={(e) => setTickFormData({ ...tickFormData, tick_grade: e.target.value })}
                >
                  <option value="">Same as problem grade ({problem.grade})</option>
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
                <label htmlFor="suggested-grade">Suggested Grade (Optional):</label>
                <select
                  id="suggested-grade"
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
                <label htmlFor="tick-rating">Rate this Problem (Optional):</label>
                <StarRating
                  rating={tickFormData.rating ? parseFloat(tickFormData.rating) : 0}
                  onChange={(rating) => setTickFormData({ ...tickFormData, rating: rating })}
                  editable={true}
                  size="medium"
                />
                <small>Rate this problem from 1 to 5 stars based on your experience</small>
              </div>
              <div className="form-group">
                <label htmlFor="tick-notes">Notes (Optional):</label>
                <textarea
                  id="tick-notes"
                  value={tickFormData.notes}
                  onChange={(e) => setTickFormData({ ...tickFormData, notes: e.target.value })}
                  rows="3"
                  placeholder="Add any notes about your send..."
                />
              </div>
              <div className="modal-actions">
                {isTicked && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={async () => {
                      if (window.confirm('Are you sure you want to delete this tick?')) {
                        try {
                          await ticksAPI.delete(currentTick.id);
                          setShowTickModal(false);
                          await checkTick();
                          fetchStatistics();
                          fetchProblemTicks();
                        } catch (err) {
                          console.error('❌ Failed to delete tick:', err);
                          alert('Failed to delete tick. Please try again.');
                        }
                      }
                    }}
                  >
                    Delete Tick
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setShowTickModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {isTicked ? 'Update Tick' : 'Add Tick'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProblemDetail;

