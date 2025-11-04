import React, { useState } from 'react';
import { Ticket, Event } from '../types';
import StarIcon from './icons/StarIcon';

interface ReviewModalProps {
  ticket: (Ticket & { event: Event });
  onClose: () => void;
  onSubmit: (ticketId: string, rating: number, reviewText: string) => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ ticket, onClose, onSubmit }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    onSubmit(ticket.ticketId, rating, reviewText);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-[1000] flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-900">Leave a Review</h2>
          <p className="text-gray-600 mt-1">Share your experience at <span className="font-semibold">{ticket.event.title}</span></p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <div className="mb-6">
              <label className="block text-lg font-semibold text-gray-800 mb-3">Your Rating</label>
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <StarIcon
                    key={star}
                    className={`w-10 h-10 cursor-pointer transition-colors ${
                      (hoverRating || rating) >= star ? 'text-yellow-400' : 'text-gray-300'
                    }`}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                  />
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="review-text" className="block text-lg font-semibold text-gray-800 mb-3">Your Review</label>
              <textarea
                id="review-text"
                rows={5}
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="What did you like or dislike? Would you recommend this event?"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-shadow"
              />
            </div>
          </div>
          <div className="p-6 bg-gray-50 border-t flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={rating === 0 || isSubmitting}
              className="px-6 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReviewModal;