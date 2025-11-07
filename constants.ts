import { Event, EventCategory, User } from './types';

export const EVENT_CATEGORIES: EventCategory[] = ['Music', 'Art', 'Food', 'Tech', 'Sports', 'Community'];

export const MOCK_USERS: Record<string, User> = {
  admin: {
    id: 'admin-1',
    name: 'Admin User',
    email: 'mufwaya.zm@gmail.com',
    role: 'admin',
    status: 'active',
    interests: [],
    attendedEvents: [],
    subscriptionTier: 'Pro',
    authProviders: ['local'],
  },
};

export const MOCK_EVENTS: Event[] = [];
