import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { listsAPI } from '../services/api';
import './ListDetail.css';

const ListDetail = () => {
  const { id } = useParams();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('todo');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    if (id) {
      fetchList();
    }
  }, [id, isAuthenticated, navigate]);

  const fetchList = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await listsAPI.get(id);
      setList(response.data);
    } catch (err) {
      console.error('Failed to fetch list:', err);
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message ||
                          'Failed to load list. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteList = async () => {
    if (!window.confirm('Are you sure you want to delete this list?')) {
      return;
    }

    try {
      await listsAPI.delete(id);
      navigate('/my-lists');
    } catch (err) {
      console.error('Failed to delete list:', err);
      setError('Failed to delete list. Please try again.');
    }
  };

  const handleRemoveProblem = async (problemId) => {
    try {
      await listsAPI.removeProblem(id, problemId);
      fetchList(); // Refresh list
    } catch (err) {
      console.error('Failed to remove problem:', err);
      setError('Failed to remove problem from list.');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric'
    });
  };

  const getGradeRange = (problems) => {
    if (!problems || problems.length === 0) return '-';
    const grades = problems.map(p => p.problem?.grade).filter(Boolean);
    if (grades.length === 0) return '-';
    const sortedGrades = grades.sort((a, b) => {
      const gradeOrder = ['3', '3+', '4', '4+', '5', '5+', '6A', '6A+', '6B', '6B+', '6C', '6C+', 
                          '7A', '7A+', '7B', '7B+', '7C', '7C+', '8A', '8A+', '8B', '8B+', '8C', '8C+', '9A', '9A+'];
      return gradeOrder.indexOf(a) - gradeOrder.indexOf(b);
    });
    const min = sortedGrades[0];
    const max = sortedGrades[sortedGrades.length - 1];
    return min === max ? min : `${min} - ${max}`;
  };

  const getCompletionPercentage = (problems) => {
    if (!problems || problems.length === 0) return 0;
    // For now, we'll assume a problem is "completed" if it has been ticked
    // This would need to be checked against user's ticks
    return 0; // Placeholder - would need tick data
  };

  const filteredProblems = list?.problems?.filter(entry => {
    if (!entry?.problem) return false;
    
    const query = searchQuery.toLowerCase();
    const problem = entry.problem;
    const matchesSearch = !query || 
      problem?.name?.toLowerCase().includes(query) ||
      problem?.grade?.toLowerCase().includes(query) ||
      problem?.area?.name?.toLowerCase().includes(query);
    
    // Status filter would check if problem is ticked
    // For now, all are "todo" until we integrate tick data
    const matchesStatus = statusFilter === 'all' || statusFilter === 'todo';
    
    return matchesSearch && matchesStatus;
  }) || [];

  const isOwner = list?.user?.id === user?.id;

  if (loading) {
    return (
      <div className="list-detail-page">
        <div className="loading">Loading list...</div>
      </div>
    );
  }

  if (error || !list) {
    return (
      <div className="list-detail-page">
        <div className="error-message">{error || 'List not found'}</div>
        <Link to="/my-lists" className="back-link">← Back to My Lists</Link>
      </div>
    );
  }

  return (
    <div className="list-detail-page">
      {/* Header */}
      <div className="list-detail-header-section">
        <div className="header-content">
          <nav className="breadcrumb">
            <Link to="/profile">Dashboard</Link>
            <span className="breadcrumb-separator">/</span>
            <Link to="/my-lists">Lists</Link>
            <span className="breadcrumb-separator">/</span>
            <span>{list.name}</span>
          </nav>
          <h1 className="page-title">{list.name}</h1>
        </div>
        {isOwner && (
          <div className="header-actions">
            <Link to="/my-lists" className="back-button">
              <span className="material-symbols-outlined">arrow_back</span>
              Back to Lists
            </Link>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="list-detail-container">
        {/* List Header */}
        <div className="list-header-card">
          <div className="list-header-info">
            <h2 className="list-title">{list.name}</h2>
            <div className="list-meta">
              <span>Created {formatDate(list.created_at)}</span>
              <span className="meta-separator"></span>
              <span>{list.problem_count || list.problems?.length || 0} Problems</span>
              {list.problem_count > 0 && (
                <>
                  <span className="meta-separator"></span>
                  <span className="grade-range">{getGradeRange(list.problems)}</span>
                </>
              )}
            </div>
            {list.description && (
              <p className="list-description">{list.description}</p>
            )}
          </div>
          {isOwner && (
            <div className="list-header-actions">
              <button className="action-button" title="Edit list">
                <span className="material-symbols-outlined">edit</span>
              </button>
              <button 
                className="action-button delete-button"
                onClick={handleDeleteList}
                title="Delete list"
              >
                <span className="material-symbols-outlined">delete</span>
              </button>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        {list.problem_count > 0 && (
          <div className="list-progress-card">
            <div className="progress-track">
              <div 
                className="progress-fill" 
                style={{ width: `${getCompletionPercentage(list.problems)}%` }}
              />
            </div>
            <span className="progress-label">
              {getCompletionPercentage(list.problems)}% Complete
            </span>
          </div>
        )}

        {/* Search and Filters */}
        {isOwner && (
          <div className="list-search-card">
            <div className="search-input-wrapper">
              <span className="search-icon material-symbols-outlined">search</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search database to add problems..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                className="browse-button"
                onClick={() => navigate('/problems')}
              >
                Browse Database
              </button>
            </div>
            <div className="filter-tags">
              <button 
                className={`filter-tag ${statusFilter === 'all' ? 'active' : ''}`}
                onClick={() => setStatusFilter('all')}
              >
                All Grades
              </button>
              <button 
                className={`filter-tag ${statusFilter === 'todo' ? 'active' : ''}`}
                onClick={() => setStatusFilter('todo')}
              >
                To Do
              </button>
              <button 
                className={`filter-tag ${statusFilter === 'sent' ? 'active' : ''}`}
                onClick={() => setStatusFilter('sent')}
              >
                Sent
              </button>
            </div>
          </div>
        )}

        {/* Problems Table */}
        <div className="list-problems-card">
          {list.problem_count === 0 || filteredProblems.length === 0 ? (
            <div className="empty-list-state">
              <div className="empty-icon">
                <span className="material-symbols-outlined">format_list_bulleted</span>
              </div>
              <h3>No Problems Yet</h3>
              {list.problem_count === 0 ? (
                <>
                  <p>This list is empty. Start adding problems to build your project list!</p>
                  {isOwner && (
                    <button 
                      className="btn-primary"
                      onClick={() => navigate('/problems')}
                    >
                      <span className="material-symbols-outlined">add</span>
                      Browse Problems to Add
                    </button>
                  )}
                </>
              ) : (
                <p>No problems match your current search or filter.</p>
              )}
            </div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="problems-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Grade</th>
                      <th>Route</th>
                      <th>Area</th>
                      <th>Status</th>
                      {isOwner && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProblems.map((entry, index) => {
                      const problem = entry.problem;
                      if (!problem) return null;
                      
                      return (
                        <tr key={entry.id || index} className={index % 2 === 1 ? 'highlighted' : ''}>
                          <td className="drag-handle">
                            <span className="material-symbols-outlined">drag_indicator</span>
                          </td>
                          <td className="grade-cell">{problem.grade || '-'}</td>
                          <td className="route-cell">
                            <Link 
                              to={`/problems/${problem.id}`}
                              className="route-link"
                            >
                              {problem.name || 'Unknown'}
                            </Link>
                            {/* Star rating would go here if available */}
                          </td>
                          <td className="area-cell">
                            {problem.area ? (
                              <Link 
                                to={`/areas/${problem.area.id}`}
                                className="area-link"
                              >
                                {problem.area.name}
                              </Link>
                            ) : '-'}
                          </td>
                          <td className="status-cell">
                            <span className="status-badge todo">Project</span>
                          </td>
                          {isOwner && (
                            <td className="action-cell">
                              <button 
                                className="remove-button"
                                onClick={() => handleRemoveProblem(problem.id)}
                                title="Remove from list"
                              >
                                <span className="material-symbols-outlined">remove_circle</span>
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Table Footer */}
              <div className="table-footer">
                {isOwner && (
                  <span className="footer-text">Drag items to reorder your priority list.</span>
                )}
                <div className="footer-actions">
                  <button className="footer-link">Export CSV</button>
                  <button className="footer-link">Print Guide</button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ListDetail;

