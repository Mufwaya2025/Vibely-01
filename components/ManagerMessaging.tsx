import React, { useState, useEffect, useRef } from 'react';
import { User, Message } from '../types';
import { 
  connectToMessaging, 
  sendMessage, 
  onMessageReceived, 
  onMessageSent, 
  onMessageRead, 
  onUserOnline, 
  onUserOffline, 
  markMessageAsRead,
  disconnectFromMessaging,
  getSocket
} from '../services/messagingService';

interface ManagerMessagingProps {
  user: User;
  onClose: () => void;
}

interface Conversation {
  userId: string;
  userName: string;
  lastMessage: string;
  lastMessageTime: string;
  unread: number;
  isOnline: boolean;
}

const ManagerMessaging: React.FC<ManagerMessagingProps> = ({ user, onClose }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [contacts, setContacts] = useState<User[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize connection when component mounts
  useEffect(() => {
    const initMessaging = async () => {
      try {
        await connectToMessaging(user.id);
        console.log('Connected to messaging service');
      } catch (error) {
        console.error('Failed to connect to messaging:', error);
      }
    };
    initMessaging();

    // Set up event listeners
    const handleReceiveMessage = (message: Message) => {
      console.log('Received message:', message); // For debugging
      // Update conversations list
      setConversations(prev => {
        const existing = prev.find(c => c.userId === message.senderId);
        if (existing) {
          return prev.map(c => 
            c.userId === message.senderId 
              ? { 
                  ...c, 
                  lastMessage: message.content, 
                  lastMessageTime: message.timestamp,
                  unread: c.userId === activeConversation ? c.unread : c.unread + 1
                } 
              : c
          );
        } else {
          // Add new conversation if not existing
          return [
            {
              userId: message.senderId,
              userName: message.senderName,
              lastMessage: message.content,
              lastMessageTime: message.timestamp,
              unread: c.userId === activeConversation ? 0 : 1,
              isOnline: true
            },
            ...prev
          ];
        }
      });

      // If this is the active conversation, add to messages
      if (message.senderId === activeConversation) {
        setMessages(prev => [...prev, message]);
        // Mark as read when received in active conversation
        markMessageAsRead(message.id);
      }
    };

    const handleMessageSent = (message: Message) => {
      console.log('Message sent:', message);
      if (message.receiverId === activeConversation) {
        setMessages(prev => [...prev, message]);
      }
      
      // Also update the conversation list with the sent message
      setConversations(prev => {
        const existing = prev.find(c => c.userId === message.receiverId);
        if (existing) {
          return prev.map(c => 
            c.userId === message.receiverId 
              ? { 
                  ...c, 
                  lastMessage: message.content, 
                  lastMessageTime: message.timestamp,
                  // unread count stays 0 since we're the sender
                } 
              : c
          );
        } else {
          // Add to conversation list if replying to a new contact
          return [
            {
              userId: message.receiverId,
              userName: conversations.find(c => c.userId === message.receiverId)?.userName || 'User',
              lastMessage: message.content,
              lastMessageTime: message.timestamp,
              unread: 0, // unread is 0 since we just sent the message
              isOnline: true
            },
            ...prev
          ];
        }
      });
    };

    onMessageReceived(handleReceiveMessage);
    onMessageSent(handleMessageSent);

    // Set up online/offline status listeners
    const handleUserOnline = (userId: string) => {
      setConversations(prev => 
        prev.map(conv => 
          conv.userId === userId ? { ...conv, isOnline: true } : conv
        )
      );
    };

    const handleUserOffline = (userId: string) => {
      setConversations(prev => 
        prev.map(conv => 
          conv.userId === userId ? { ...conv, isOnline: false } : conv
        )
      );
    };

    onUserOnline(handleUserOnline);
    onUserOffline(handleUserOffline);

    // Clean up on unmount
    return () => {
      disconnectFromMessaging();
    };
  }, [user.id, activeConversation]);

  // Load conversations when component mounts
  useEffect(() => {
    // In a real app, we would fetch conversations from an API
    // For now, we'll keep an empty array since conversations will be populated by incoming messages
    setConversations([]);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load messages when active conversation changes
  const loadMessages = (userId: string) => {
    setActiveConversation(userId);
    // In a real app, fetch messages for this conversation from the API
    // For now, we'll just clear existing messages and start fresh
    setMessages([]);
  };

  const handleSendMessage = () => {
    if (!newMessage.trim() || !activeConversation) return;

    // Create message object
    const messageData = {
      receiverId: activeConversation,
      content: newMessage,
      senderId: user.id,
      senderName: user.name
    };

    // Send via messaging service
    sendMessage(messageData);
    
    // Clear the input field
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl overflow-hidden animate-fade-in-up flex flex-col h-[85vh] max-h-[900px]">
        <div className="p-4 border-b flex justify-between items-center">
          <div className="flex items-center">
            <h2 className="text-xl font-bold text-gray-900">Messages</h2>
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

        <div className="flex flex-1 overflow-hidden">
          {/* Conversations sidebar */}
          <div className="w-1/3 border-r flex flex-col">
            <div className="p-3 border-b">
              <h3 className="font-semibold text-gray-800">Recent Chats</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {conversations.map((conv) => (
                <div
                  key={conv.userId}
                  className={`p-3 border-b cursor-pointer hover:bg-gray-50 flex items-center ${
                    activeConversation === conv.userId ? 'bg-purple-50' : ''
                  }`}
                  onClick={() => loadMessages(conv.userId)}
                >
                  <div className="flex-shrink-0 mr-3">
                    <div className={`w-3 h-3 rounded-full ${conv.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <h4 className="font-semibold truncate">{conv.userName}</h4>
                      <span className="text-xs text-gray-500">
                        {new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
                      {conv.unread > 0 && (
                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chat area */}
          <div className="w-2/3 flex flex-col">
            {activeConversation ? (
              <>
                <div className="p-3 border-b flex items-center">
                  <div className="flex-shrink-0 mr-3">
                    <div className={`w-3 h-3 rounded-full ${conversations.find(c => c.userId === activeConversation)?.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  </div>
                  <h3 className="font-semibold text-gray-800">
                    {conversations.find(c => c.userId === activeConversation)?.userName}
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                  {messages.length === 0 ? (
                    <div className="flex justify-center items-center h-full text-gray-500">
                      No messages yet. Start the conversation!
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div 
                          key={msg.id} 
                          className={`flex ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}
                        >
                          <div 
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              msg.senderId === user.id 
                                ? 'bg-purple-500 text-white rounded-tr-none' 
                                : 'bg-white text-gray-800 rounded-tl-none border border-gray-200'
                            }`}
                          >
                            <p>{msg.content}</p>
                            <div className={`text-xs mt-1 ${msg.senderId === user.id ? 'text-purple-200' : 'text-gray-500'}`}>
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
                      placeholder={`Message ${conversations.find(c => c.userId === activeConversation)?.userName}...`}
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
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center p-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <h4 className="mt-4 font-semibold text-gray-700">No conversation selected</h4>
                  <p className="mt-1 text-sm text-gray-500">Select a contact from the list to start chatting</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerMessaging;