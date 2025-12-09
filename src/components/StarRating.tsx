"use client";

import { useState, useRef, useEffect } from "react";

type StarRatingProps = {
  value: number;
  onChange: (value: number) => void;
  size?: "sm" | "md" | "lg";
  allowHalf?: boolean;
  disabled?: boolean;
  className?: string;
};

export default function StarRating({
  value,
  onChange,
  size = "md",
  allowHalf = true,
  disabled = false,
  className = "",
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const sizeClasses = {
    sm: "text-lg",
    md: "text-xl",
    lg: "text-3xl",
  };

  const starSize = sizeClasses[size];

  // Calculer la valeur basée sur la position de la souris/touch
  const getValueFromPosition = (clientX: number): number => {
    if (!containerRef.current) return 0;

    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, x / width));

    if (allowHalf) {
      // Permettre les demi-étoiles (0.5, 1, 1.5, 2, etc.)
      const rawValue = percentage * 5;
      const rounded = Math.round(rawValue * 2) / 2; // Arrondir à 0.5 près
      return Math.max(0.5, Math.min(5, rounded));
    } else {
      // Seulement des étoiles entières
      const rawValue = percentage * 5;
      const rounded = Math.ceil(rawValue);
      return Math.max(1, Math.min(5, rounded));
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (disabled || !isDragging) return;
    const newValue = getValueFromPosition(e.clientX);
    setHoverValue(newValue);
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (disabled || !isDragging) return;
    const newValue = getValueFromPosition(e.clientX);
    onChange(newValue);
    setHoverValue(null);
    setIsDragging(false);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (disabled) return;
    e.preventDefault();
    const touch = e.touches[0];
    if (touch) {
      const newValue = getValueFromPosition(touch.clientX);
      setHoverValue(newValue);
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (disabled) return;
    const touch = e.changedTouches[0];
    if (touch && containerRef.current) {
      const newValue = getValueFromPosition(touch.clientX);
      onChange(newValue);
      setHoverValue(null);
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, disabled]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    const newValue = getValueFromPosition(e.clientX);
    setHoverValue(newValue);
  };

  const handleClick = (starValue: number) => {
    if (disabled) return;
    onChange(starValue);
  };

  const displayValue = hoverValue ?? value;

  // Rendre les étoiles avec support des demi-étoiles
  const renderStars = () => {
    if (allowHalf) {
      // Afficher 5 étoiles avec support des demi-étoiles
      return [1, 2, 3, 4, 5].map((star) => {
        const isFull = displayValue >= star;
        const isHalf = displayValue >= star - 0.5 && displayValue < star;

        return (
          <button
            key={star}
            type="button"
            onClick={() => handleClick(star)}
            disabled={disabled}
            className={`${starSize} leading-none transition-transform hover:scale-110 active:scale-95 relative ${
              disabled ? "cursor-not-allowed" : "cursor-pointer"
            }`}
            style={{ touchAction: "none" }}
          >
            {/* Étoile de fond (gris) */}
            <span className="text-slate-600">★</span>
            {/* Étoile active (jaune) */}
            {isFull && (
              <span className="absolute inset-0 text-yellow-400">★</span>
            )}
            {/* Demi-étoile */}
            {isHalf && (
              <span
                className="absolute inset-0 text-yellow-400 overflow-hidden"
                style={{ width: "50%" }}
              >
                ★
              </span>
            )}
          </button>
        );
      });
    } else {
      // Afficher seulement des étoiles entières
      return [1, 2, 3, 4, 5].map((star) => {
        const isActive = displayValue >= star;
        return (
          <button
            key={star}
            type="button"
            onClick={() => handleClick(star)}
            disabled={disabled}
            className={`${starSize} leading-none transition-transform hover:scale-110 active:scale-95 ${
              disabled ? "cursor-not-allowed" : "cursor-pointer"
            }`}
            style={{ touchAction: "none" }}
          >
            <span className={isActive ? "text-yellow-400" : "text-slate-600"}>
              ★
            </span>
          </button>
        );
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex gap-1 items-center ${className}`}
      onMouseDown={handleMouseDown}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: "none", userSelect: "none" }}
    >
      {renderStars()}
    </div>
  );
}

