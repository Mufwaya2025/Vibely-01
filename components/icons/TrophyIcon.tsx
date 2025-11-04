import React from 'react';

const TrophyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.5 18.75h-9a9.75 9.75 0 001.05-4.223 7.5 7.5 0 0111.4 0 9.75 9.75 0 001.05 4.223z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 1.5v4.5m0 0l-1.5 1.5m1.5-1.5l1.5 1.5M12 6a4.5 4.5 0 014.5 4.5v1.5a.75.75 0 00.75.75h.75a.75.75 0 00.75-.75V10.5a6 6 0 00-6-6zM7.5 6a4.5 4.5 0 00-4.5 4.5v1.5a.75.75 0 01-.75.75H1.5a.75.75 0 01-.75-.75V10.5a6 6 0 016-6z"
    />
  </svg>
);

export default TrophyIcon;
