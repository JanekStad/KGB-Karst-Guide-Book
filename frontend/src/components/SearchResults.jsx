import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import './SearchResults.css';

const SearchResults = ({ results, onClose, query, anchorElement }) => {
  const resultsRef = useRef(null);

  useEffect(() => {
    if (resultsRef.current && anchorElement) {
      const updatePosition = () => {
        const anchorRect = anchorElement.getBoundingClientRect();
        const resultsEl = resultsRef.current;
        if (resultsEl) {
          // For fixed positioning, use viewport coordinates (getBoundingClientRect already gives viewport-relative)
          resultsEl.style.top = `${anchorRect.bottom + 8}px`;
          resultsEl.style.left = `${anchorRect.left}px`;
          resultsEl.style.width = `${anchorRect.width}px`;
        }
      };

      updatePosition();
      
      // Use requestAnimationFrame for smoother updates
      let rafId;
      const handleScroll = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(updatePosition);
      };

      // Listen to scroll on window and all scrollable parents
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', updatePosition);
      
      // Also listen to scroll on the main content area if it exists
      const mainContent = document.querySelector('.main-content');
      if (mainContent) {
        mainContent.addEventListener('scroll', handleScroll, true);
      }

      return () => {
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', updatePosition);
        if (mainContent) {
          mainContent.removeEventListener('scroll', handleScroll, true);
        }
      };
    }
  }, [anchorElement]);

  if (!query) return null;
  
  // Show loading state if query exists but no results yet
  const isLoading = query && query.length >= 2 && !results;

  const { problems = [], areas = [], sectors = [], users = [] } = results || {};
  const hasResults = problems.length > 0 || areas.length > 0 || sectors.length > 0 || users.length > 0;

  const resultsContent = (
    <div className="search-results" ref={resultsRef}>
      {isLoading ? (
        <div className="search-results-empty">
          <p>Searching...</p>
        </div>
      ) : !hasResults ? (
        <div className="search-results-empty">
          <p>No results found for &quot;{query}&quot;</p>
        </div>
      ) : (
        <>
          {problems.length > 0 && (
            <div className="search-results-section">
              <h3 className="search-results-section-title">
                <span className="material-symbols-outlined">boulder</span>
                Problems ({problems.length})
              </h3>
              <div className="search-results-list">
                {problems.map((problem) => (
                  <Link
                    key={problem.id}
                    to={`/problems/${problem.id}`}
                    className="search-result-item"
                    onClick={onClose}
                  >
                    <div className="search-result-content">
                      <div className="search-result-name">{problem.name}</div>
                      <div className="search-result-meta">
                        {problem.grade && <span className="search-result-grade">{problem.grade}</span>}
                        {problem.area && <span className="search-result-location">{problem.area.name}</span>}
                        {problem.tickCount > 0 && (
                          <span className="search-result-count">{problem.tickCount} ticks</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {areas.length > 0 && (
            <div className="search-results-section">
              <h3 className="search-results-section-title">
                <span className="material-symbols-outlined">landscape</span>
                Areas ({areas.length})
              </h3>
              <div className="search-results-list">
                {areas.map((area) => (
                  <Link
                    key={area.id}
                    to={`/crags/${area.id}`}
                    className="search-result-item"
                    onClick={onClose}
                  >
                    <div className="search-result-content">
                      <div className="search-result-name">{area.name}</div>
                      <div className="search-result-meta">
                        {area.city && <span className="search-result-location">{area.city.name}</span>}
                        {area.problemCount > 0 && (
                          <span className="search-result-count">{area.problemCount} problems</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {sectors.length > 0 && (
            <div className="search-results-section">
              <h3 className="search-results-section-title">
                <span className="material-symbols-outlined">location_on</span>
                Sectors ({sectors.length})
              </h3>
              <div className="search-results-list">
                {sectors.map((sector) => (
                  <Link
                    key={sector.id}
                    to={`/sectors/${sector.id}`}
                    className="search-result-item"
                    onClick={onClose}
                  >
                    <div className="search-result-content">
                      <div className="search-result-name">{sector.name}</div>
                      <div className="search-result-meta">
                        {sector.area && (
                          <span className="search-result-location">
                            {sector.area.name}
                            {sector.area.city && `, ${sector.area.city.name}`}
                          </span>
                        )}
                        {sector.problemCount > 0 && (
                          <span className="search-result-count">{sector.problemCount} problems</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {users.length > 0 && (
            <div className="search-results-section">
              <h3 className="search-results-section-title">
                <span className="material-symbols-outlined">person</span>
                Users ({users.length})
              </h3>
              <div className="search-results-list">
                {users.map((user) => (
                  <Link
                    key={user.id}
                    to={`/user/${user.id}`}
                    className="search-result-item"
                    onClick={onClose}
                  >
                    <div className="search-result-content">
                      <div className="search-result-name">{user.username}</div>
                      {user.email && (
                        <div className="search-result-meta">
                          <span className="search-result-location">{user.email}</span>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return createPortal(resultsContent, document.body);
};

export default SearchResults;
