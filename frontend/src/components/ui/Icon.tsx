import React from 'react';
import { cn } from '@/lib/utils';

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  size?: number | string;
}

export const Icon: React.FC<IconProps> = ({ 
  name, 
  className = '', 
  filled = false,
  size = 24 
}) => {
  return (
    <span
      className={cn(
        'material-symbols-outlined',
        filled && 'icon-fill',
        className
      )}
      style={{ fontSize: typeof size === 'number' ? `${size}px` : size }}
    >
      {name}
    </span>
  );
};


