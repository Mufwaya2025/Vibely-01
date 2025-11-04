import React from 'react';

const Footer: React.FC = () => {
  const footerNav = [
    { name: 'About', href: '#' },
    { name: 'Blog', href: '#' },
    { name: 'Careers', href: '#' },
    { name: 'Press', href: '#' },
    { name: 'Contact', href: '#' },
    { name: 'Privacy', href: '#' },
    { name: 'Terms', href: '#' },
  ];
  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <nav className="flex flex-wrap justify-center" aria-label="Footer">
          {footerNav.map((item) => (
            <div key={item.name} className="px-5 py-2">
              <a href={item.href} className="text-base text-gray-500 hover:text-gray-900">
                {item.name}
              </a>
            </div>
          ))}
        </nav>
        <div className="mt-8 flex justify-center space-x-6">
          {/* Social media icons can go here */}
        </div>
        <p className="mt-8 text-center text-base text-gray-400">&copy; 2024 Vibely. Where Zambia Comes to Life.</p>
      </div>
    </footer>
  );
};

export default Footer;
