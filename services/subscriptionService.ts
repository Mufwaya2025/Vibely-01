import { PaymentMethod, SubscriptionTier, User } from '../types';
import { apiFetch, apiFetchJson } from '../utils/apiClient';
import { processPayment } from './paymentService';

const DEFAULT_SUBSCRIPTION_METHODS: PaymentMethod[] = ['MobileMoney', 'CreditCard'];

export interface SubscriptionTierFetchOptions {
  includeInactive?: boolean;
  scope?: 'public' | 'admin';
}

/**
 * Fetches subscription tiers from the backend. Defaults to the public endpoint which only
 * returns active tiers. Pass scope: 'admin' to retrieve the full dataset.
 */
export const getSubscriptionTiers = async (
  options: SubscriptionTierFetchOptions = {}
): Promise<SubscriptionTier[]> => {
  const { scope = 'public', includeInactive = false } = options;

  if (scope === 'admin') {
    return apiFetchJson<SubscriptionTier[]>('/api/admin/subscriptions/tiers');
  }

  const query = includeInactive ? '?includeInactive=true' : '';
  return apiFetchJson<SubscriptionTier[]>(`/api/subscriptions/tiers${query}`);
};

/**
 * Creates a new subscription tier.
 * @param tierData The data for the new subscription tier.
 * @returns Promise resolving to the created subscription tier.
 */
export const createSubscriptionTier = async (
  tierData: Omit<SubscriptionTier, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SubscriptionTier> => {
  const response = await apiFetch('/api/admin/subscriptions/tiers', {
    method: 'POST',
    body: tierData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to create subscription tier');
  }

  return await response.json();
};

/**
 * Updates an existing subscription tier.
 * @param tier The updated subscription tier data.
 * @returns Promise resolving to the updated subscription tier.
 */
export const updateSubscriptionTier = async (
  tier: Partial<SubscriptionTier> & { id: string }
): Promise<SubscriptionTier> => {
  const response = await apiFetch('/api/admin/subscriptions/tiers', {
    method: 'PUT',
    body: tier,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to update subscription tier');
  }

  return await response.json();
};

/**
 * Deletes a subscription tier.
 * @param id The ID of the subscription tier to delete.
 * @returns Promise resolving when the tier is deleted.
 */
export const deleteSubscriptionTier = async (id: string): Promise<void> => {
  const response = await apiFetch('/api/admin/subscriptions/tiers', {
    method: 'DELETE',
    body: { id },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to delete subscription tier');
  }
};

/**
 * Handles upgrading a user's subscription to the Pro tier.
 * @param options Upgrade options including the user and selected tier.
 * @returns Promise resolving to the payment result from the Lenco checkout flow.
 */
export interface UpgradeToProOptions {
  user: User;
  tier: SubscriptionTier;
  paymentMethods?: PaymentMethod[];
  customerPhone?: string;
}

export type SubscriptionUpgradeResult = Awaited<ReturnType<typeof processPayment>>;

export const upgradeToPro = async ({
  user,
  tier,
  paymentMethods,
  customerPhone,
}: UpgradeToProOptions): Promise<SubscriptionUpgradeResult> => {
  if (!tier) {
    throw new Error('No subscription tier selected.');
  }
  if (typeof tier.price !== 'number' || Number.isNaN(tier.price) || tier.price <= 0) {
    throw new Error('The selected subscription tier does not have a valid price.');
  }

  const methods =
    paymentMethods && paymentMethods.length > 0 ? paymentMethods : DEFAULT_SUBSCRIPTION_METHODS;

  const nameParts = user.name.trim().split(/\s+/);
  const firstName = nameParts[0] ?? user.name;
  const lastName = nameParts.slice(1).join(' ') || undefined;

  return processPayment({
    purpose: 'subscription',
    userId: user.id,
    amount: tier.price,
    currency: tier.currency,
    metadata: {
      tierId: tier.id,
      tierName: tier.name,
      billingPeriod: tier.billingPeriod,
    },
    paymentMethods: methods,
    label: `${tier.name} Subscription`,
    customer: {
      firstName,
      lastName,
      phone: customerPhone,
    },
  });
};

/**
 * Downgrades a user's subscription back to the Regular tier and clears any subscription transactions.
 * @param userId The ID of the user whose subscription should be cancelled.
 */
export const cancelSubscription = async (userId: string): Promise<User> => {
  const response = await apiFetch('/api/subscriptions', {
    method: 'DELETE',
    body: { userId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to cancel subscription');
  }

  return (await response.json()) as User;
};
