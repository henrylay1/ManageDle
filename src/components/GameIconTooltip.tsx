import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './GameIconTooltip.css';

interface GameIconTooltipProps {
  icon: string;
  description?: string | null;
  className?: string;
}

export const GameIconTooltip = ({ icon, description, className }: GameIconTooltipProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  const tooltipText = description || 'N/A';

  const updateCoords = () => {
    const el = wrapperRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ left: r.left + r.width / 2, top: r.top });
  };

  useEffect(() => {
    if (!showTooltip) return;
    updateCoords();
    window.addEventListener('scroll', updateCoords, true);
    window.addEventListener('resize', updateCoords);
    return () => {
      window.removeEventListener('scroll', updateCoords, true);
      window.removeEventListener('resize', updateCoords);
    };
  }, [showTooltip]);

  return (
    <span
      ref={wrapperRef}
      className={`game-icon-tooltip-wrapper ${className || ''}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="game-icon-tooltip-content">{icon}</span>
      {showTooltip && coords && createPortal(
        <div
          className="game-icon-tooltip-popup-portal"
          style={{ left: coords.left, top: coords.top }}
        >
          {tooltipText}
          <div className="game-icon-tooltip-arrow" />
        </div>,
        document.body
      )}
    </span>
  );
};
