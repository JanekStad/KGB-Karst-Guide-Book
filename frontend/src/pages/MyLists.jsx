import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { listsAPI } from '../services/api';
import './MyLists.css';

const MyLists = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [lists, setLists] = useState([]);
  const [selectedList, setSelectedList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    is_public: false,
  });
  const [creating, setCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    fetchLists();
  }, [isAuthenticated, navigate]);

  const fetchLists = async () => {
    try {
      setLoading(true);
      const response = await listsAPI.list();
      const listsData = response.data?.results || response.data;
      const listsArray = Array.isArray(listsData) ? listsData : [];
      setLists(listsArray);
      
      // Auto-select first list if available
      if (listsArray.length > 0 && !selectedList) {
        setSelectedList(listsArray[0]);
      }
    } catch (err) {
      console.error('Failed to fetch lists:', err);
      setError('Failed to load your lists. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchListDetails = async (listId) => {
    try {
      const response = await listsAPI.get(listId);
      const updatedList = response.data;
      setSelectedList(updatedList);
      // Update the list in the lists array to keep it in sync
      setLists(prevLists => 
        prevLists.map(list => list.id === listId ? updatedList : list)
      );
    } catch (err) {
      console.error('Failed to fetch list details:', err);
      setError('Failed to load list details.');
    }
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!createFormData.name.trim()) {
      setError('List name is required');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const response = await listsAPI.create(createFormData);
      const newList = response.data;
      // Fetch full list details including problems
      await fetchListDetails(newList.id);
      setLists([...lists, newList]);
      setShowCreateModal(false);
      setCreateFormData({ name: '', description: '', is_public: false });
      setError(null);
    } catch (err) {
      console.error('Failed to create list:', err);
      const errorMessage = err.response?.data?.name?.[0] || 
                          err.response?.data?.detail ||
                          'Failed to create list. Please try again.';
      setError(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleSelectList = (list) => {
    if (selectedList?.id !== list.id) {
      fetchListDetails(list.id);
    }
  };

  const handleDeleteList = async (listId) => {
    if (!window.confirm('Are you sure you want to delete this list?')) {
      return;
    }

    try {
      await listsAPI.delete(listId);
      const updatedLists = lists.filter(l => l.id !== listId);
      setLists(updatedLists);
      if (selectedList?.id === listId) {
        setSelectedList(updatedLists.length > 0 ? updatedLists[0] : null);
      }
    } catch (err) {
      console.error('Failed to delete list:', err);
      setError('Failed to delete list. Please try again.');
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

  const filteredProblems = selectedList?.problems?.filter(entry => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const problem = entry.problem;
    return (
      problem?.name?.toLowerCase().includes(query) ||
      problem?.grade?.toLowerCase().includes(query) ||
      problem?.area?.name?.toLowerCase().includes(query)
    );
  }) || [];

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="my-lists-page">
        <div className="loading">Loading your lists...</div>
      </div>
    );
  }

  return (
    <div className="my-lists-page">
      {error && <div className="error-message">{error}</div>}
      
      {/* Header */}
      <div className="lists-header">
        <div className="header-left">
          <nav className="breadcrumb">
            <Link to="/profile">Dashboard</Link>
            <span className="breadcrumb-separator">/</span>
            <span>Lists</span>
          </nav>
          <h1 className="page-title">Project Lists</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="lists-tabs-container">
        <nav className="lists-tabs" aria-label="Tabs">
          <Link to="/profile" className="lists-tab">
            <span className="material-symbols-outlined">history</span>
            My Tick List
          </Link>
          <span className="lists-tab active">
            <span className="material-symbols-outlined">format_list_bulleted</span>
            Personal Lists & Projects
            {lists.length > 0 && (
              <span className="tab-badge">{lists.length}</span>
            )}
          </span>
          <Link to="/explore" className="lists-tab">
            <span className="material-symbols-outlined">map</span>
            Map View
          </Link>
        </nav>
      </div>

      {/* Main Content */}
      <div className="lists-main-container">
        {/* Sidebar */}
        <aside className="lists-sidebar">
          <div className="sidebar-header">
            <h3 className="sidebar-title">Your Lists</h3>
            <button className="sort-button" title="Sort lists">
              <span className="material-symbols-outlined">sort</span>
            </button>
          </div>
          
          <div className="lists-scroll-container">
            {lists.map((list) => {
              const isSelected = selectedList?.id === list.id;
              const completion = getCompletionPercentage(list.problems);
              const problemCount = list.problem_count || list.problems?.length || 0;
              
              return (
                <div
                  key={list.id}
                  className={`list-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectList(list)}
                >
                  <div className="list-card-header">
                    <h4 className="list-card-name">{list.name}</h4>
                    {isSelected && (
                      <span className="material-symbols-outlined pin-icon">push_pin</span>
                    )}
                  </div>
                  {list.description && (
                    <p className="list-card-description">{list.description}</p>
                  )}
                  <div className="list-card-stats">
                    <span className="list-stat">
                      <span className="material-symbols-outlined">landscape</span>
                      {problemCount} items
                    </span>
                    <span className="list-stat">
                      <span className="material-symbols-outlined">check_circle</span>
                      {0} sent
                    </span>
                  </div>
                  {problemCount > 0 && (
                    <div className="list-progress-bar">
                      <div 
                        className="list-progress-fill" 
                        style={{ width: `${completion}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button 
            className="create-list-button"
            onClick={() => setShowCreateModal(true)}
          >
            <div className="create-list-icon">
              <span className="material-symbols-outlined">add</span>
            </div>
            <span>Create New List</span>
          </button>
        </aside>

        {/* Main Content Area */}
        <main className="lists-main-content">
          {selectedList ? (
            <>
              {/* List Header */}
              <div className="list-detail-header">
                <div className="list-detail-info">
                  <h2 className="list-detail-title">{selectedList.name}</h2>
                  <div className="list-detail-meta">
                    <span>Created {formatDate(selectedList.created_at)}</span>
                    <span className="meta-separator"></span>
                    <span>{selectedList.problem_count || 0} Problems</span>
                    <span className="meta-separator"></span>
                    <span className="grade-range">{getGradeRange(selectedList.problems)}</span>
                  </div>
                </div>
                <div className="list-detail-actions">
                  <button className="action-button" title="Edit list">
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  <button 
                    className="action-button delete-button"
                    onClick={() => handleDeleteList(selectedList.id)}
                    title="Delete list"
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="list-progress-section">
                <div className="list-progress-track">
                  <div 
                    className="list-progress-indicator" 
                    style={{ width: `${getCompletionPercentage(selectedList.problems)}%` }}
                  />
                </div>
                <span className="progress-text">
                  {getCompletionPercentage(selectedList.problems)}% Complete
                </span>
              </div>

              {/* Search and Filters */}
              <div className="list-search-section">
                <div className="search-input-wrapper">
                  <span className="search-icon material-symbols-outlined">search</span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search database to add problems..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button className="browse-button">
                    Browse Database
                  </button>
                </div>
                <div className="filter-tags">
                  <button className="filter-tag">All Grades</button>
                  <button className="filter-tag active">To Do</button>
                  <button className="filter-tag">Sent</button>
                </div>
              </div>

              {/* Problems Table */}
              <div className="problems-table-container">
                <table className="problems-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Grade</th>
                      <th>Route</th>
                      <th>Area</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProblems.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="empty-table-message">
                          {searchQuery 
                            ? 'No problems found matching your search.'
                            : 'No problems in this list yet. Use the search above to add problems.'
                          }
                        </td>
                      </tr>
                    ) : (
                      filteredProblems.map((entry, index) => {
                        const problem = entry.problem;
                        return (
                          <tr key={entry.id || index} className={index % 2 === 1 ? 'highlighted' : ''}>
                            <td className="drag-handle">
                              <span className="material-symbols-outlined">drag_indicator</span>
                            </td>
                            <td className="grade-cell">{problem?.grade || '-'}</td>
                            <td className="route-cell">
                              <div className="route-name">{problem?.name || 'Unknown'}</div>
                              {/* Star rating would go here if available */}
                            </td>
                            <td className="area-cell">{problem?.area?.name || '-'}</td>
                            <td className="status-cell">
                              <span className="status-badge todo">Project</span>
                            </td>
                            <td className="action-cell">
                              <button 
                                className="remove-button"
                                onClick={() => {
                                  // TODO: Implement remove problem
                                  console.log('Remove problem', problem?.id);
                                }}
                              >
                                <span className="material-symbols-outlined">remove_circle</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              <div className="table-footer">
                <span className="footer-text">Drag items to reorder your priority list.</span>
                <div className="footer-actions">
                  <button className="footer-link">Export CSV</button>
                  <button className="footer-link">Print Guide</button>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-list-state">
              <h3>No List Selected</h3>
              <p>Select a list from the sidebar or create a new one to get started.</p>
            </div>
          )}
        </main>
      </div>

      {/* Create List Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content create-list-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New List</h2>
              <button 
                className="modal-close"
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateFormData({ name: '', description: '', is_public: false });
                  setError(null);
                }}
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateList} className="create-list-form">
              <div className="form-group">
                <label htmlFor="list-name">List Name *</label>
                <input
                  type="text"
                  id="list-name"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  placeholder="e.g., Bishop Trip 2024"
                  required
                  maxLength={200}
                />
              </div>
              <div className="form-group">
                <label htmlFor="list-description">Description</label>
                <textarea
                  id="list-description"
                  value={createFormData.description}
                  onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                  placeholder="Optional description for this list..."
                  rows="4"
                  maxLength={500}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={createFormData.is_public}
                    onChange={(e) => setCreateFormData({ ...createFormData, is_public: e.target.checked })}
                  />
                  <span>Make this list public</span>
                </label>
              </div>
              <div className="modal-actions">
                <button 
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateFormData({ name: '', description: '', is_public: false });
                    setError(null);
                  }}
                  disabled={creating}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="btn-primary"
                  disabled={creating || !createFormData.name.trim()}
                >
                  {creating ? 'Creating...' : 'Create List'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLists;
