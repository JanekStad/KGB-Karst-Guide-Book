import { useState } from 'react';
import './StarRating.css';

const StarRating = ({ rating = 0, onChange, editable = false, size = 'medium' }) => {
  const [hoverRating, setHoverRating] = useState(0);

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

  const displayRating = hoverRating || rating;

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
      {rating > 0 && (
        <span className="rating-value">{rating.toFixed(1)}</span>
      )}
    </div>
  );
};

export default StarRating;

