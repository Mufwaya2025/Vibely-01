import React from 'react';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLoginClick: () => void;
  onLogout: () => void;
  onShowTickets: () => void;
  purchasedTicketsCount: number;
  onDashboardClick?: () => void;
  canAccessDashboard?: boolean;
  dashboardLabel?: string;
}

const Header: React.FC<HeaderProps> = ({
  user,
  onLoginClick,
  onLogout,
  onShowTickets,
  purchasedTicketsCount,
  onDashboardClick,
  canAccessDashboard,
  dashboardLabel,
}) => {
  return (
    <header className="bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex-shrink-0">
            <h1 className="text-2xl font-bold text-purple-600">Vibely</h1>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <span className="text-sm font-medium text-gray-700 hidden sm:block">
                  Welcome, {user.name.split(' ')[0]}!
                </span>
                {user.role === 'attendee' && purchasedTicketsCount > 0 ? (
                  <button
                    onClick={onShowTickets}
                    className="relative px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-full hover:bg-purple-700 transition-colors shadow"
                  >
                    My Tickets
                    <span className="absolute -top-1 -right-1 flex h-5 w-5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-white text-purple-600 text-xs font-semibold items-center justify-center">
                        {purchasedTicketsCount}
                      </span>
                    </span>
                  </button>
                ) : canAccessDashboard && onDashboardClick && (
                  <button
                    onClick={onDashboardClick}
                    className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-full hover:bg-purple-700 transition-colors shadow"
                  >
                    {dashboardLabel ?? 'Dashboard'}
                  </button>
                )}
                <button
                  onClick={onLogout}
                  className="px-4 py-2 text-sm font-medium text-purple-600 border border-purple-600 rounded-full hover:bg-purple-50 transition-colors"
                >
                  Log Out
                </button>
              </>
            ) : (
              <button
                onClick={onLoginClick}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-full hover:bg-purple-700 transition-colors shadow"
              >
                Log In
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
