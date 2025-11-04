import { db } from './db';
import { SubscriptionTier } from '../types';

/**
 * Handles fetching all subscription tiers.
 * @returns {Response} A list of all subscription tiers.
 */
export async function handleGetSubscriptionTiers() {
  await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay
  
  const tiers = db.subscriptionTiers.findAll();
  return new Response(JSON.stringify(tiers), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handles creating a new subscription tier.
 * @param req The request object containing the tier data in the body.
 * @returns {Response} The created subscription tier.
 */
export async function handleCreateSubscriptionTier(req: { body: Omit<SubscriptionTier, 'id' | 'createdAt' | 'updatedAt'> }) {
  const { body } = req;
  
  // Validate required fields
  if (!body.name || body.price === undefined || body.currency === undefined) {
    return new Response(JSON.stringify({ message: 'Name, price, and currency are required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
  
  try {
    const newTier = db.subscriptionTiers.create(body);
    return new Response(JSON.stringify(newTier), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ message: 'Failed to create subscription tier.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handles updating an existing subscription tier.
 * @param req The request object containing the tier ID and updates in the body.
 * @returns {Response} The updated subscription tier.
 */
export async function handleUpdateSubscriptionTier(req: { 
  body: { id: string } & Partial<SubscriptionTier> 
}) {
  const { id, ...updates } = req.body;
  
  if (!id) {
    return new Response(JSON.stringify({ message: 'Tier ID is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
  
  const updatedTier = db.subscriptionTiers.update(id, updates);
  if (!updatedTier) {
    return new Response(JSON.stringify({ message: 'Subscription tier not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify(updatedTier), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Handles deleting a subscription tier.
 * @param req The request object containing the tier ID in the body.
 * @returns {Response} Success or error message.
 */
export async function handleDeleteSubscriptionTier(req: { body: { id: string } }) {
  const { id } = req.body;
  
  if (!id) {
    return new Response(JSON.stringify({ message: 'Tier ID is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Don't allow deletion of default tiers
  if (id === 'tier-regular' || id === 'tier-pro') {
    return new Response(JSON.stringify({ message: 'Default tiers cannot be deleted.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  await new Promise(resolve => setTimeout(resolve, 300)); // Simulate network delay
  
  const deleted = db.subscriptionTiers.delete(id);
  if (!deleted) {
    return new Response(JSON.stringify({ message: 'Subscription tier not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  
  return new Response(JSON.stringify({ message: 'Subscription tier deleted successfully.' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}