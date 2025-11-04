import React, { useMemo } from 'react';
import { User, SubscriptionTier } from '../types';
import CheckIcon from './icons/CheckIcon';
import XIcon from './icons/XIcon';

interface SettingsDashboardProps {
  user: User;
  onUpgradeClick: () => void;
  onDowngradeClick: () => void;
  subscriptionTiers: SubscriptionTier[];
  isLoadingTiers: boolean;
  tiersError: string | null;
  isDowngrading: boolean;
  downgradeError: string | null;
}

const formatPrice = (tier: SubscriptionTier) => {
  if (tier.price === 0) return 'Free';
  try {
    return new Intl.NumberFormat('en-ZM', {
      style: 'currency',
      currency: tier.currency,
      minimumFractionDigits: tier.price % 1 === 0 ? 0 : 2,
    }).format(tier.price);
  } catch {
    return `${tier.currency} ${tier.price}`;
  }
};

const formatBillingPeriod = (period: SubscriptionTier['billingPeriod']) => {
  switch (period) {
    case 'monthly':
      return '/month';
    case 'yearly':
      return '/year';
    case 'one-time':
    default:
      return '';
  }
};

const SettingsDashboard: React.FC<SettingsDashboardProps> = ({
  user,
  onUpgradeClick,
  onDowngradeClick,
  subscriptionTiers,
  isLoadingTiers,
  tiersError,
  isDowngrading,
  downgradeError,
}) => {
  const activeTiers = useMemo(
    () =>
      subscriptionTiers
        .filter((tier) => tier.isActive)
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [subscriptionTiers]
  );

  const featureList = useMemo(() => {
    const features = new Set<string>();
    activeTiers.forEach((tier) => {
      Object.keys(tier.features || {}).forEach((feature) => features.add(feature));
    });
    return Array.from(features);
  }, [activeTiers]);

  const currentTierName = user.subscriptionTier || 'Regular';
  const currentTier =
    activeTiers.find((tier) => tier.name === currentTierName) ||
    (user.subscriptionTier === 'Pro'
      ? activeTiers.find((tier) => tier.name.toLowerCase() === 'pro')
      : activeTiers.find((tier) => tier.name.toLowerCase() === 'regular'));
  const isPro = (user.subscriptionTier ?? 'Regular') === 'Pro';
  const primaryActionLabel = isPro ? 'Downgrade to Regular' : 'Upgrade Account';
  const primaryActionDisabled = isPro ? isDowngrading : !activeTiers.length;
  const renewalText =
    user.subscriptionExpiresAt && isPro
      ? `Renews on ${new Date(user.subscriptionExpiresAt).toLocaleDateString()}`
      : undefined;

  return (
    <div className="bg-white py-12 sm:py-16 rounded-xl shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Powerful Tools for Event Organizers
          </h2>
          <p className="mt-4 text-xl text-gray-500">
            Choose the plan that's right for you. Go Pro for unlimited potential.
          </p>
        </div>

        <div className="mt-10">
          <div className="rounded-2xl border border-purple-200 bg-purple-50 px-6 py-6 sm:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-purple-700 uppercase tracking-wide">
                Current Subscription
              </p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {currentTier?.name ?? currentTierName}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {currentTier?.description ||
                  (isPro
                    ? 'Enjoy unlimited events, premium analytics, and dedicated support.'
                    : 'You are on the starter plan. Upgrade for unlimited events and advanced tools.')}
              </p>
              {renewalText && <p className="mt-2 text-xs text-gray-500">{renewalText}</p>}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={isPro ? onDowngradeClick : onUpgradeClick}
                disabled={primaryActionDisabled}
                className={`w-full sm:w-auto whitespace-nowrap rounded-md px-5 py-3 text-base font-medium text-white ${
                  isPro
                    ? 'bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400'
                    : 'bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300'
                } ${primaryActionDisabled ? 'cursor-not-allowed opacity-80' : ''}`}
              >
                {isPro && isDowngrading ? 'Processing downgrade...' : primaryActionLabel}
              </button>
              <button
                type="button"
                onClick={onUpgradeClick}
                className="w-full sm:w-auto whitespace-nowrap rounded-md px-5 py-3 text-base font-medium border border-purple-300 text-purple-700 hover:bg-white"
              >
                Explore Plans
              </button>
            </div>
          </div>
        </div>

        {tiersError && (
          <p className="mt-6 text-center text-sm text-red-600">{tiersError}</p>
        )}

        <div className="mt-12 space-y-8 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto">
          {isLoadingTiers && activeTiers.length === 0 && (
            <div className="col-span-2 text-center text-gray-500">Loading subscription plans...</div>
          )}
          {!isLoadingTiers && activeTiers.length === 0 && !tiersError && (
            <div className="col-span-2 text-center text-gray-500">
              No subscription plans are currently available. Please check back later.
            </div>
          )}
          {activeTiers.map((tier) => {
            const isCurrentUserTier = tier.name === currentTierName;
            const isDowngrade =
              currentTier && tier.id !== currentTier.id && tier.price < currentTier.price;
            const billingPeriodLabel = formatBillingPeriod(tier.billingPeriod);
            return (
              <div
                key={tier.name}
                className={`rounded-2xl border ${
                  isCurrentUserTier ? 'border-purple-500 ring-2 ring-purple-500' : 'border-gray-200'
                } shadow-lg p-6 relative flex flex-col`}
              >
                {tier.isPopular && !isCurrentUserTier && (
                  <div className="absolute top-0 right-6 -mt-4">
                    <div className="bg-purple-600 text-white px-3 py-1 text-sm font-semibold tracking-wide uppercase rounded-full shadow-md">
                      Most Popular
                    </div>
                  </div>
                )}
                <div className="flex-grow">
                    <h3 className="text-2xl font-semibold text-gray-900">{tier.name}</h3>
                    <p className="mt-4 flex items-baseline text-gray-900">
                        <span className="text-4xl font-extrabold tracking-tight">{formatPrice(tier)}</span>
                        {billingPeriodLabel && (
                          <span className="ml-1 text-xl font-semibold">
                            {billingPeriodLabel}
                          </span>
                        )}
                    </p>
                    <p className="mt-4 text-gray-500 h-12">
                        {tier.description ||
                          (tier.price === 0
                            ? 'Perfect for getting started and small events.'
                            : 'Unlock advanced tools to maximize your event\'s success.')}
                    </p>
                    
                    <ul role="list" className="mt-8 space-y-4">
                        {featureList.map((feature) => {
                          const featureValue = tier.features?.[feature];
                          const isBooleanValue = typeof featureValue === 'boolean';
                          return (
                        <li key={feature} className="flex items-start">
                            {isBooleanValue ? (
                            featureValue ? (
                                <CheckIcon className="flex-shrink-0 h-6 w-6 text-green-500" />
                            ) : (
                                <XIcon className="flex-shrink-0 h-6 w-6 text-red-400" />
                            )
                            ) : (
                                <CheckIcon className="flex-shrink-0 h-6 w-6 text-purple-500" />
                            )}
                            <span className="ml-3 text-sm text-gray-600">
                                <span className="font-medium text-gray-800">{feature}:</span>{' '}
                                {featureValue !== undefined ? `${featureValue}` : 'Not included'}
                            </span>
                        </li>
                        );
                        })}
                    </ul>
                </div>
                <div className="mt-8">
                    {isCurrentUserTier ? (
                        <div className="text-center">
                            <button
                                disabled
                                className="w-full text-center rounded-md px-5 py-3 text-base font-medium bg-gray-200 text-gray-600 cursor-default"
                            >
                                Current Plan
                            </button>
                            {user.subscriptionExpiresAt && <p className="text-xs text-gray-500 mt-2">Renews on {new Date(user.subscriptionExpiresAt).toLocaleDateString()}</p>}
                        </div>

                    ) : (
                         <button
                            onClick={isDowngrade ? onDowngradeClick : onUpgradeClick}
                            disabled={isDowngrade && isDowngrading}
                            className={`w-full text-center rounded-md px-5 py-3 text-base font-medium ${
                            tier.isPopular
                                ? 'bg-purple-600 text-white hover:bg-purple-700'
                                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                            } ${isDowngrade && isDowngrading ? 'cursor-wait opacity-80' : ''}`}
                        >
                            {isDowngrade
                              ? isDowngrading
                                ? 'Downgrading...'
                                : 'Downgrade'
                              : `Upgrade to ${tier.name}`}
                        </button>
                    )}
                </div>
              </div>
            );
          })}
        </div>
        {downgradeError && (
          <p className="mt-6 text-center text-sm text-red-600">{downgradeError}</p>
        )}
      </div>
    </div>
  );
};

export default SettingsDashboard;
