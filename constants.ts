import { Event, EventCategory, User } from './types';

export const EVENT_CATEGORIES: EventCategory[] = ['Music', 'Art', 'Food', 'Tech', 'Sports', 'Community'];

export const MOCK_USERS: { [email: string]: User } = {
  'admin@vibely.com': {
    id: 'admin-001',
    name: 'Super Admin',
    email: 'admin@vibely.com',
    role: 'admin',
    status: 'active',
    interests: [],
    attendedEvents: [],
  },
};

export const MOCK_EVENTS: Event[] = [];
