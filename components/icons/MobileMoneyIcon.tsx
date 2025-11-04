import React from 'react';

const MobileMoneyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    {...props}
  >
    <path d="M17.25 5.25H6.75a2.25 2.25 0 00-2.25 2.25v10.5a2.25 2.25 0 002.25 2.25h10.5a2.25 2.25 0 002.25-2.25V7.5a2.25 2.25 0 00-2.25-2.25zM12 15.75a3.75 3.75 0 110-7.5 3.75 3.75 0 010 7.5z" />
    <path fillRule="evenodd" clipRule="evenodd" d="M12 14.25a2.25 2.25 0 100-4.5 2.25 2.25 0 000 4.5z" />
  </svg>
);

export default MobileMoneyIcon;
