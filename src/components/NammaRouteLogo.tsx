import React from 'react';
import { cn } from '../lib/utils';

interface NammaRouteLogoProps {
  className?: string;
  size?: number;
}

export const NammaRouteLogo: React.FC<NammaRouteLogoProps> = ({ className, size = 40 }) => {
  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Background stylized path/shape */}
        <path
          d="M20 80C20 80 25 40 50 40C75 40 80 80 80 80"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
          className="text-brand-primary opacity-20"
        />
        
        {/* Main 'N' stylized as a route */}
        <path
          d="M30 75V25L70 75V25"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-brand-primary"
        />
        
        {/* Route indicator dot */}
        <circle cx="70" cy="25" r="8" fill="currentColor" className="text-brand-secondary" />
        
        {/* Small bus silhouette inside the 'N' */}
        <path
          d="M45 45H55V52H45V45ZM46 52V54H48V52H46ZM52 52V54H54V52H52Z"
          fill="white"
        />
      </svg>
    </div>
  );
};
