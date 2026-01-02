import { useState } from 'react';
import './StarRating.css';

const StarRating = ({ rating = 0, onChange, editable = false, size = 'medium', showValue = true }) => {
  const [hoverRating, setHoverRating] = useState(0);

  // Ensure rating is always a number
  const numericRating = typeof rating === 'number' ? rating : parseFloat(rating) || 0;

  const handleClick = (value) => {
    if (editable && onChange) {
      onChange(value);
    }
  };

  const handleMouseEnter = (value) => {
    if (editable) {
      setHoverRating(value);
    }
  };

  const handleMouseLeave = () => {
    if (editable) {
      setHoverRating(0);
    }
  };

  const displayRating = hoverRating || numericRating;

  return (
    <div className={`star-rating ${editable ? 'editable' : ''} ${size}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= displayRating;
        const isHalf = star - 0.5 === displayRating;
        return (
          <span
            key={star}
            className={`star ${isFilled ? 'filled' : ''} ${isHalf ? 'half' : ''}`}
            onClick={() => handleClick(star)}
            onMouseEnter={() => handleMouseEnter(star)}
            onMouseLeave={handleMouseLeave}
            title={editable ? `Rate ${star} ${star === 1 ? 'star' : 'stars'}` : ''}
          >
            ★
          </span>
        );
      })}
      {numericRating > 0 && showValue && (
        <span className="rating-value">{numericRating.toFixed(1)}</span>
      )}
    </div>
  );
};

export default StarRating;

