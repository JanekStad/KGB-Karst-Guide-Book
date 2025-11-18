import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { commentsAPI, problemsAPI, ticksAPI } from '../services/api';
import './ProblemDetail.css';

const ProblemDetail = () => {
  const { id } = useParams();
  const { isAuthenticated } = useAuth();
  const [problem, setProblem] = useState(null);
  const [comments, setComments] = useState([]);
  const [isTicked, setIsTicked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProblem();
    fetchComments();
  }, [id]);

  const checkTick = useCallback(async () => {
    if (!isAuthenticated) {
      console.log('⏭️ Skipping tick check - user not authenticated');
      setIsTicked(false);
      return;
    }
    try {
      console.log('📡 Checking tick status for problem ID:', id);
      const response = await ticksAPI.list();
      const ticks = response.data.results || response.data;
      // Tick.problem is a nested object, so we need to check problem.id
      const ticked = ticks.some((tick) => {
        const problemId = tick.problem?.id || tick.problem;
        return problemId === parseInt(id);
      });
      console.log('✅ Tick status:', ticked ? 'Ticked' : 'Not ticked', { ticks, problemId: id });
      setIsTicked(ticked);
    } catch (err) {
      console.error('❌ Failed to check tick:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
      });
      setIsTicked(false);
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

  const handleTick = async () => {
    if (!isAuthenticated) {
      alert('Please login to tick problems');
      return;
    }

    try {
      if (isTicked) {
        // Find and delete the tick
        const response = await ticksAPI.list();
        const ticks = response.data.results || response.data;
        const tick = ticks.find((t) => {
          const problemId = t.problem?.id || t.problem;
          return problemId === parseInt(id);
        });
        if (tick) {
          await ticksAPI.delete(tick.id);
          console.log('✅ Tick removed');
        }
        setIsTicked(false);
      } else {
        await ticksAPI.create({
          problem: parseInt(id),
          date: new Date().toISOString().split('T')[0],
        });
        console.log('✅ Tick created');
        // Re-check tick status to ensure it's properly set
        await checkTick();
      }
    } catch (err) {
      console.error('❌ Failed to toggle tick:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response,
        status: err.response?.status,
        data: err.response?.data,
      });
      
      // If it's a duplicate error, refresh the tick status
      if (err.response?.status === 400 || err.response?.status === 409) {
        console.log('🔄 Refreshing tick status due to error...');
        await checkTick();
      } else {
        alert('Failed to update tick. Please try again.');
      }
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
      {(problem.crag_detail || problem.crag) && (
        <Link
          to={`/crags/${(problem.crag_detail || problem.crag)?.id || problem.crag}`}
          className="back-link"
        >
          ← Back to Crag
        </Link>
      )}

      <div className="problem-header">
        <div className="problem-title-section">
          <div className="problem-grade-large">{problem.grade}</div>
          <div>
            <h1>{problem.name}</h1>
            {(problem.crag_detail || problem.crag) && (
              <p className="crag-link">
                At{' '}
                <Link to={`/crags/${(problem.crag_detail || problem.crag)?.id || problem.crag}`}>
                  {(problem.crag_detail || problem.crag)?.name || `Crag #${(problem.crag_detail || problem.crag)?.id || problem.crag}`}
                </Link>
                {(problem.wall_detail || problem.wall) && (
                  <span> - {(problem.wall_detail || problem.wall)?.name}</span>
                )}
              </p>
            )}
          </div>
        </div>
        {isAuthenticated && (
          <button
            onClick={handleTick}
            className={`btn-tick ${isTicked ? 'ticked' : ''}`}
          >
            {isTicked ? '✓ Ticked' : '+ Tick'}
          </button>
        )}
      </div>

      {problem.description && (
        <div className="problem-description">
          <h2>Description</h2>
          <p>{problem.description}</p>
        </div>
      )}

      {problem.images && problem.images.length > 0 && (
        <div className="images-section">
          <h2>Images</h2>
          <div className="images-grid">
            {problem.images.map((image) => (
              <div key={image.id} className="image-item">
                <img src={image.image} alt={image.caption || problem.name} />
                {image.caption && (
                  <p className="image-caption">{image.caption}</p>
                )}
              </div>
            ))}
          </div>
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
    </div>
  );
};

export default ProblemDetail;

