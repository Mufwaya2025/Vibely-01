import React, { useState, useEffect } from 'react';
// Fix: Import AnalysisData from types.ts where it is now defined.
import { User, Event, AnalysisData } from '../types';
import { getAnalysisData } from '../services/analysisService';
import TrophyIcon from './icons/TrophyIcon';
import TagIcon from './icons/TagIcon';
import UsersIcon from './icons/UsersIcon';

interface AnalysisDashboardProps {
  user: User;
  events: Event[];
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ user, events }) => {
  const [data, setData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (events.length > 0) {
      setIsLoading(true);
      getAnalysisData(user.id, events)
        .then(setData)
        .finally(() => setIsLoading(false));
    } else {
        setIsLoading(false);
        setData(null);
    }
  }, [user.id, events]);

  if (isLoading) {
    return <div className="p-8 text-center">Loading analytics...</div>;
  }
  
  if (events.length === 0 || !data) {
    return (
        <div className="text-center py-16">
            <h3 className="text-xl font-semibold text-gray-800">No data to display.</h3>
            <p className="text-gray-500 mt-2">Create some events and sell tickets to see analytics.</p>
        </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Top Performing Event */}
        {data.topPerformingEvent && (
          <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm">
            <h3 className="font-semibold text-gray-800 flex items-center mb-4">
              <TrophyIcon className="w-6 h-6 mr-2 text-yellow-500" />
              Top Performing Event
            </h3>
            <div className="flex items-center space-x-4">
                <img src={data.topPerformingEvent.imageUrl} alt={data.topPerformingEvent.title} className="w-20 h-20 rounded-lg object-cover" />
                <div>
                    <p className="font-bold text-gray-900">{data.topPerformingEvent.title}</p>
                    <p className="text-sm text-gray-500">Reviews: {data.topPerformingEvent.reviewCount}</p>
                    <p className="text-sm text-gray-500">Rating: {data.topPerformingEvent.averageRating?.toFixed(1)}</p>
                </div>
            </div>
          </div>
        )}

        {/* Demographics */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm">
          <h3 className="font-semibold text-gray-800 flex items-center mb-4">
             <UsersIcon className="w-6 h-6 mr-2 text-blue-500" />
            Audience Demographics
          </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                   <h4 className="text-sm font-medium text-gray-600 mb-2">By Gender</h4>
                   <ul className="space-y-2">
                       {Object.entries(data.demographics.gender).map(([key, value]) => (
                           <li key={key}>
                               <div className="flex justify-between text-sm mb-1">
                                   <span>{key}</span>
                                   <span>{value}%</span>
                               </div>
                               <div className="w-full bg-gray-200 rounded-full h-2.5">
                                   <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${value}%` }}></div>
                               </div>
                           </li>
                       ))}
                   </ul>
               </div>
               <div>
                   <h4 className="text-sm font-medium text-gray-600 mb-2">By Age</h4>
                   <ul className="space-y-2">
                       {Object.entries(data.demographics.age).map(([key, value]) => (
                           <li key={key}>
                               <div className="flex justify-between text-sm mb-1">
                                   <span>{key}</span>
                                   <span>{value}%</span>
                               </div>
                               <div className="w-full bg-gray-200 rounded-full h-2.5">
                                   <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${value}%` }}></div>
                               </div>
                           </li>
                       ))}
                   </ul>
               </div>
           </div>
        </div>
      </div>
      
      {/* Sales Data */}
      <div className="bg-white p-6 rounded-xl shadow-sm">
        <h3 className="font-semibold text-gray-800 flex items-center mb-4">
            <TagIcon className="w-6 h-6 mr-2 text-green-500" />
            Ticket Sales by Category
        </h3>
        <ul className="space-y-3">
            {data.salesData.byCategory.sort((a,b) => b.tickets - a.tickets).map(item => (
                <li key={item.category}>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{item.category}</span>
                        <span className="text-gray-600">{item.tickets} tickets</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                        <div className="bg-green-500 h-4 rounded-full" style={{ width: `${(item.tickets / Math.max(...data.salesData.byCategory.map(c => c.tickets))) * 100}%` }}></div>
                    </div>
                </li>
            ))}
        </ul>
      </div>

    </div>
  );
};

export default AnalysisDashboard;