import { useState, useRef, useEffect } from 'react';
import './InteractiveBoulderImage.css';

/**
 * InteractiveBoulderImage component displays a boulder image with interactive lines
 * showing problem routes. Lines can be hovered to highlight them.
 * 
 * @param {Object} props
 * @param {string} props.imageUrl - URL of the image to display
 * @param {Array} props.problemLines - Array of problem line objects with coordinates
 * @param {string} props.caption - Optional caption for the image
 * @param {number} props.currentProblemId - ID of the current problem being viewed (optional)
 */
const InteractiveBoulderImage = ({ 
  imageUrl, 
  problemLines = [], 
  caption = '',
  currentProblemId = null 
}) => {
  const [hoveredLineId, setHoveredLineId] = useState(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [imageError, setImageError] = useState(false);
  const imageRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const updateImageSize = () => {
      if (imageRef.current) {
        setImageSize({
          width: imageRef.current.offsetWidth,
          height: imageRef.current.offsetHeight,
        });
      }
    };

    updateImageSize();
    window.addEventListener('resize', updateImageSize);
    
    // Also update when image loads
    if (imageRef.current?.complete) {
      updateImageSize();
    }

    return () => window.removeEventListener('resize', updateImageSize);
  }, [imageUrl]);

  const handleImageLoad = () => {
    if (imageRef.current) {
      setImageSize({
        width: imageRef.current.offsetWidth,
        height: imageRef.current.offsetHeight,
      });
      setImageError(false);
    }
  };

  const handleImageError = () => {
    console.error('Failed to load image:', imageUrl);
    setImageError(true);
  };

  // Convert normalized coordinates (0-1) to pixel coordinates
  const getPixelCoordinates = (normalizedCoords) => {
    if (!imageSize.width || !imageSize.height) return [];
    
    return normalizedCoords.map(point => ({
      x: point.x * imageSize.width,
      y: point.y * imageSize.height,
    }));
  };

  // Generate SVG path string from coordinates
  const getPathString = (coordinates) => {
    const pixelCoords = getPixelCoordinates(coordinates);
    if (pixelCoords.length === 0) return '';

    let path = `M ${pixelCoords[0].x} ${pixelCoords[0].y}`;
    for (let i = 1; i < pixelCoords.length; i++) {
      path += ` L ${pixelCoords[i].x} ${pixelCoords[i].y}`;
    }
    return path;
  };

  const handleLineMouseEnter = (lineId) => {
    setHoveredLineId(lineId);
  };

  const handleLineMouseLeave = () => {
    setHoveredLineId(null);
  };

  if (!imageUrl) {
    console.warn('InteractiveBoulderImage: No imageUrl provided');
    return null;
  }

  return (
    <div className="interactive-boulder-image-container" ref={containerRef}>
      <div className="interactive-image-wrapper">
        {imageError ? (
          <div className="image-error">
            <p>Failed to load image</p>
            <p className="image-url-debug">{imageUrl}</p>
          </div>
        ) : (
          <img
            ref={imageRef}
            src={imageUrl}
            alt={caption || 'Boulder problem'}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className="boulder-image"
          />
        )}
        {imageSize.width > 0 && imageSize.height > 0 && problemLines.length > 0 && (
          <svg
            className="line-overlay"
            width={imageSize.width}
            height={imageSize.height}
            style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          >
            {problemLines.map((line) => {
              const isHovered = hoveredLineId === line.id;
              const isCurrentProblem = currentProblemId && line.problem_id === currentProblemId;
              const pathString = getPathString(line.coordinates);
              
              if (!pathString) return null;

              // Determine line color and width based on state
              let lineColor = line.color || '#FF0000';
              let lineWidth = 3;
              
              if (isHovered) {
                lineColor = '#FFFF00'; // Yellow on hover
                lineWidth = 5;
              } else if (isCurrentProblem) {
                lineColor = '#00FF00'; // Green for current problem
                lineWidth = 4;
              }

              return (
                <g key={line.id}>
                  {/* Invisible wider path for easier hovering */}
                  <path
                    d={pathString}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={15}
                    style={{ pointerEvents: 'all', cursor: 'pointer' }}
                    onMouseEnter={() => handleLineMouseEnter(line.id)}
                    onMouseLeave={handleLineMouseLeave}
                  />
                  {/* Visible line */}
                  <path
                    d={pathString}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth={lineWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      transition: 'stroke 0.2s ease, stroke-width 0.2s ease',
                      filter: isHovered ? 'drop-shadow(0 0 4px rgba(255, 255, 0, 0.8))' : 'none',
                    }}
                  />
                  {/* Start marker */}
                  {line.coordinates.length > 0 && (
                    <circle
                      cx={getPixelCoordinates([line.coordinates[0]])[0]?.x}
                      cy={getPixelCoordinates([line.coordinates[0]])[0]?.y}
                      r={isHovered ? 6 : 4}
                      fill={lineColor}
                      style={{
                        transition: 'r 0.2s ease, fill 0.2s ease',
                        filter: isHovered ? 'drop-shadow(0 0 4px rgba(255, 255, 0, 0.8))' : 'none',
                      }}
                    />
                  )}
                  {/* End marker */}
                  {line.coordinates.length > 1 && (
                    <circle
                      cx={getPixelCoordinates([line.coordinates[line.coordinates.length - 1]])[0]?.x}
                      cy={getPixelCoordinates([line.coordinates[line.coordinates.length - 1]])[0]?.y}
                      r={isHovered ? 6 : 4}
                      fill={lineColor}
                      style={{
                        transition: 'r 0.2s ease, fill 0.2s ease',
                        filter: isHovered ? 'drop-shadow(0 0 4px rgba(255, 255, 0, 0.8))' : 'none',
                      }}
                    />
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {hoveredLineId && (
          <div className="line-tooltip">
            {(() => {
              const hoveredLine = problemLines.find(l => l.id === hoveredLineId);
              if (!hoveredLine) return null;
              return (
                <div>
                  <strong>{hoveredLine.problem_name}</strong>
                  {hoveredLine.problem_grade && (
                    <span className="tooltip-grade"> ({hoveredLine.problem_grade})</span>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
      {caption && (
        <p className="image-caption">{caption}</p>
      )}
      {problemLines.length > 0 && (
        <div className="line-legend">
          <div className="legend-title">Problems on this image:</div>
          <div className="legend-items">
            {problemLines.map((line) => {
              const isHovered = hoveredLineId === line.id;
              const isCurrentProblem = currentProblemId && line.problem_id === currentProblemId;
              
              return (
                <div
                  key={line.id}
                  className={`legend-item ${isHovered ? 'hovered' : ''} ${isCurrentProblem ? 'current' : ''}`}
                  onMouseEnter={() => handleLineMouseEnter(line.id)}
                  onMouseLeave={handleLineMouseLeave}
                >
                  <span
                    className="legend-color"
                    style={{ backgroundColor: line.color || '#FF0000' }}
                  />
                  <span className="legend-text">
                    {line.problem_name}
                    {line.problem_grade && ` (${line.problem_grade})`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveBoulderImage;

