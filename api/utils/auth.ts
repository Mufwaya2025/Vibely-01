import { User } from '../../types';

export const requireAdmin = (user: User | null | undefined): Response | null => {
  if (!user || user.role !== 'admin') {
    return new Response(JSON.stringify({ message: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
};
