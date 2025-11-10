import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types';
import { 
  connectToMessaging, 
  sendMessage, 
  onMessageReceived, 
  onMessageSent, 
  onUserOnline, 
  onUserOffline, 
  markMessageAsRead,
  disconnectFromMessaging,
  requestUserStatus,
  onUserStatusResponse
} from '../services/messagingService';

interface MessagingProps {
  currentUser: User;
  recipient: User;
  onClose: () => void;
}

const Messaging: React.FC<MessagingProps> = ({ currentUser, recipient, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isRecipientOnline, setIsRecipientOnline] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanupFns: Array<() => void> = [];

    // Connect to messaging service
    const connect = async () => {
      try {
        await connectToMessaging(currentUser.id);
        setIsConnecting(false);
        
        // Request the current status of the recipient after connecting
        setTimeout(() => {
          requestUserStatus(recipient.id);
        }, 500); // Small delay to ensure connection is established
      } catch (error) {
        console.error('Failed to connect to messaging:', error);
        setIsConnecting(false);
      }
    };

    connect();

    // Set up event listeners
    const handleReceiveMessage = (message: Message) => {
      setMessages(prev => [...prev, message]);
      markMessageAsRead(message.id);
    };

    const handleMessageSent = (message: Message) => {
      setMessages(prev => [...prev, message]);
    };

    const handleUserOnline = (userId: string) => {
      if (userId === recipient.id) {
        setIsRecipientOnline(true);
      }
    };

    const handleUserOffline = (userId: string) => {
      if (userId === recipient.id) {
        setIsRecipientOnline(false);
      }
    };

    const handleUserStatusResponse = (data: { userId: string, isOnline: boolean }) => {
      if (data.userId === recipient.id) {
        setIsRecipientOnline(data.isOnline);
      }
    };

    cleanupFns.push(onMessageReceived(handleReceiveMessage));
    cleanupFns.push(onMessageSent(handleMessageSent));
    cleanupFns.push(onUserOnline(handleUserOnline));
    cleanupFns.push(onUserOffline(handleUserOffline));
    cleanupFns.push(onUserStatusResponse(handleUserStatusResponse));

    // Clean up on unmount
    return () => {
      cleanupFns.forEach(fn => fn && fn());
      disconnectFromMessaging();
    };
  }, [currentUser.id, recipient.id]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (newMessage.trim() === '') return;

    sendMessage({
      receiverId: recipient.id,
      content: newMessage,
      senderId: currentUser.id,
      senderName: currentUser.name
    });

    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-[1000] flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up flex flex-col h-[80vh] max-h-[800px]">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${isRecipientOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
            <h2 className="text-xl font-bold text-gray-900">{recipient.name}</h2>
            <span className="ml-2 text-xs text-gray-500">
              {isRecipientOnline ? 'Online' : 'Offline'}
            </span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-full text-gray-500 hover:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 bg-gray-50">
          {isConnecting ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex justify-center items-center h-full text-gray-500">
              No messages yet. Start the conversation!
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      msg.senderId === currentUser.id 
                        ? 'bg-purple-500 text-white rounded-tr-none' 
                        : 'bg-white text-gray-800 rounded-tl-none border border-gray-200'
                    }`}
                  >
                    <p>{msg.content}</p>
                    <div className={`text-xs mt-1 ${msg.senderId === currentUser.id ? 'text-purple-200' : 'text-gray-500'}`}>
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-white">
          <div className="flex items-end space-x-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={`Message ${recipient.name.split(' ')[0]}...`}
              className="flex-grow border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={2}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim()}
              className={`p-2 rounded-full ${
                newMessage.trim() 
                  ? 'bg-purple-600 text-white hover:bg-purple-700' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Messaging;
