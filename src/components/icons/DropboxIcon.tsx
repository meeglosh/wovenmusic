import React from 'react';

interface DropboxIconProps {
  className?: string;
  size?: number;
}

const DropboxIcon: React.FC<DropboxIconProps> = ({ className = '', size = 24 }) => {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="currentColor" 
      className={className}
    >
      <path d="M6 2L12 6L6 10L0 6L6 2ZM18 2L24 6L18 10L12 6L18 2ZM0 14L6 10L12 14L6 18L0 14ZM12 14L18 10L24 14L18 18L12 14ZM6 19L12 15L18 19L12 23L6 19Z"/>
    </svg>
  );
};

export default DropboxIcon;