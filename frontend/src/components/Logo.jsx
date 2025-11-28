import { Link } from 'react-router-dom';
import './Logo.css';

const Logo = ({ 
  size = 'medium', 
  variant = 'white', 
  showText = false,
  linkTo = '/',
  className = '',
  onClick
}) => {
  // Size presets
  const sizeMap = {
    small: '2.5rem',    // 40px
    medium: '3.125rem', // 50px
    large: '7.5rem',    // 120px
    xlarge: '9.375rem', // 150px
  };

  const logoSize = typeof size === 'number' ? `${size}px` : sizeMap[size] || sizeMap.medium;
  
  // Logo file path - update when logo is added to public folder
  // For now, using placeholder paths - replace with actual logo files
  const logoPath = variant === 'white' || variant === 'light' 
    ? '/logo-white.svg'  // White version for dark backgrounds
    : '/logo.svg';       // Default/dark version
  
  // TODO: Add logo files to frontend/public/ directory:
  // - logo.svg (dark version)
  // - logo-white.svg (white version for dark theme)

  const logoElement = (
    <div 
      className={`logo-container ${className}`}
      style={{ 
        width: logoSize, 
        height: logoSize,
        '--logo-size': logoSize
      }}
      onClick={onClick}
    >
      <img 
        src={logoPath}
        alt="In Bouldering We Trust"
        className="logo-image"
        onError={(e) => {
          // Fallback to text if image doesn't exist yet
          const img = e.target;
          const fallback = img.nextElementSibling;
          if (img) img.style.display = 'none';
          if (fallback) fallback.style.display = 'flex';
        }}
      />
      {/* Fallback text logo if image not available */}
      <div className="logo-fallback">
        <span className="logo-text">IBWT</span>
      </div>
      {showText && (
        <div className="logo-text-below">
          In Bouldering We Trust
        </div>
      )}
    </div>
  );

  // Wrap in Link if linkTo is provided
  if (linkTo && !onClick) {
    return (
      <Link to={linkTo} className="logo-link">
        {logoElement}
      </Link>
    );
  }

  return logoElement;
};

export default Logo;

