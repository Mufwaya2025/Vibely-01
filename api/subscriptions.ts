import { db } from './db';

interface UpgradeRequestBody {
  userId?: string;
  tier?: string;
}

interface CancelRequestBody {
  userId?: string;
}

/**
 * Legacy handler kept for backwards compatibility. The real upgrade flow now relies on the
 * payments/session + payments/verify endpoints to complete a Lenco checkout before upgrading.
 * Calling this endpoint without the proper payment verification will return an error.
 */
export async function handleUpgradeSubscription(req: { body?: UpgradeRequestBody }) {
  const { userId } = req.body ?? {};
  if (!userId) {
    return new Response(JSON.stringify({ message: 'userId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ message: 'Subscription upgrades must be completed through the Lenco payment flow.' }), {
    status: 409,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Resets a user's subscription back to the Regular tier. Any stored subscription transactions
 * for the user are also removed so they can attempt the upgrade flow again.
 */
export async function handleCancelSubscription(req: { body?: CancelRequestBody }) {
  const { userId } = req.body ?? {};
  if (!userId) {
    return new Response(JSON.stringify({ message: 'userId is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = db.users.findById(userId);
  if (!user) {
    return new Response(JSON.stringify({ message: 'User not found.' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updatedUser = db.users.updateSubscription(userId, 'Regular');
  if (!updatedUser) {
    return new Response(JSON.stringify({ message: 'Failed to reset subscription.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  db.gatewayTransactions.deleteWhere(
    (txn) => txn.userId === userId && txn.purpose === 'subscription'
  );

  return new Response(JSON.stringify(updatedUser), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Returns the list of subscription tiers intended for client consumption.
 * Only active tiers are returned unless includeInactive is explicitly true.
 */
export async function handleGetPublicSubscriptionTiers(req: {
  query?: { includeInactive?: string };
}) {
  const includeInactive = req.query?.includeInactive === 'true';
  const tiers = db.subscriptionTiers
    .findAll()
    .filter((tier) => includeInactive || tier.isActive);

  return new Response(JSON.stringify(tiers), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
