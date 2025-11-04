import React from 'react';

const CreditCardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    {...props}
  >
    <path d="M21.75 6.75a2.25 2.25 0 00-2.25-2.25H4.5a2.25 2.25 0 00-2.25 2.25v10.5a2.25 2.25 0 002.25 2.25h15a2.25 2.25 0 002.25-2.25V6.75z" />
    <path fill="#fff" d="M2.25 10.5h19.5V7.622a.75.75 0 00-.75-.75H3a.75.75 0 00-.75.75v2.878z" />
  </svg>
);

export default CreditCardIcon;
