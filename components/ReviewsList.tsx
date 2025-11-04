import React from 'react';
import { Ticket } from '../types';
import StarIcon from './icons/StarIcon';

interface ReviewsListProps {
  reviews: Ticket[];
  isLoading?: boolean;
}

const ReviewsList: React.FC<ReviewsListProps> = ({ reviews, isLoading }) => {
  if (isLoading) {
    return (
      <div className="mt-6 border-t pt-6">
        <h3 className="font-bold text-lg text-gray-800 mb-4">What people are saying</h3>
        <p className="text-sm text-gray-500">Loading reviews...</p>
      </div>
    );
  }

  if (reviews.length === 0) {
    return null; // Don't render the section if there are no reviews
  }

  return (
    <div className="mt-6 border-t pt-6">
      <h3 className="font-bold text-lg text-gray-800 mb-4">What people are saying</h3>
      <div className="space-y-6">
        {reviews.map((review) => (
          <div key={review.ticketId} className="flex items-start">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center mr-4 shrink-0">
              <span className="font-bold text-purple-600">
                {/* In a real app, this would be the user's initials */}
                U
              </span>
            </div>
            <div>
              <div className="flex items-center">
                {Array.from({ length: 5 }).map((_, i) => (
                  <StarIcon
                    key={i}
                    className={`w-4 h-4 ${
                      review.rating && i < review.rating ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 text-gray-600">{review.reviewText}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReviewsList;
