import { useState } from 'react';
import './GameIconTooltip.css';

interface GameIconTooltipProps {
  icon: string;
  description?: string | null;
  className?: string;
}

export const GameIconTooltip = ({ icon, description, className }: GameIconTooltipProps) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const tooltipText = description || 'N/A';

  return (
    <span
      className={`game-icon-tooltip-wrapper ${className || ''}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="game-icon-tooltip-content">{icon}</span>
      {showTooltip && (
        <div className="game-icon-tooltip-popup">
          {tooltipText}
        </div>
      )}
    </span>
  );
};
