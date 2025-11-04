import React, { useEffect, useMemo, useState } from 'react';
import { SubscriptionTier } from '../types';
import { getSubscriptionTiers } from '../services/subscriptionService';
import CheckIcon from './icons/CheckIcon';
import XIcon from './icons/XIcon';

interface OrganizerTiersProps {
  onSignUpClick?: () => void;
}

const OrganizerTiers: React.FC<OrganizerTiersProps> = ({ onSignUpClick }) => {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchTiers = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getSubscriptionTiers();
        if (isMounted) {
          setTiers(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load subscription plans.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchTiers();
    return () => {
      isMounted = false;
    };
  }, []);

  const activeTiers = useMemo(
    () =>
      tiers
        .filter((tier) => tier.isActive)
        .slice()
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [tiers]
  );

  const features = useMemo(() => {
    const featureSet = new Set<string>();
    activeTiers.forEach((tier) => {
      Object.keys(tier.features || {}).forEach((feature) => featureSet.add(feature));
    });
    return Array.from(featureSet);
  }, [activeTiers]);

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

  return (
    <div className="bg-white py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Powerful Tools for Event Organizers
          </h2>
          <p className="mt-4 text-xl text-gray-500">
            Choose the plan that's right for you. Go Pro for unlimited potential.
          </p>
        </div>

        {error && (
          <p className="mt-8 text-center text-sm text-red-600">{error}</p>
        )}

        <div className="mt-12 space-y-4 sm:mt-16 sm:space-y-0 sm:grid sm:grid-cols-2 sm:gap-6 lg:max-w-4xl lg:mx-auto xl:max-w-none xl:mx-0 xl:grid-cols-2">
          {isLoading && activeTiers.length === 0 && (
            <div className="col-span-2 text-center text-gray-500">Loading subscription plans...</div>
          )}
          {!isLoading && activeTiers.length === 0 && !error && (
            <div className="col-span-2 text-center text-gray-500">
              No subscription plans are currently available. Please check back later.
            </div>
          )}
          {activeTiers.map((tier) => {
            const billingPeriodLabel = formatBillingPeriod(tier.billingPeriod);
            const isFreeTier = tier.price === 0;
            const buttonDisabled = isFreeTier && !onSignUpClick;
            const buttonLabel = isFreeTier ? 'Start for Free' : `Go ${tier.name}`;
            const buttonCursorClass = buttonDisabled ? 'cursor-default' : 'cursor-pointer';
            return (
            <div
              key={tier.name}
              className={`rounded-2xl border ${
                tier.isPopular ? 'border-purple-500' : 'border-gray-200'
              } shadow-lg p-6 relative`}
            >
              {tier.isPopular && (
                <div className="absolute top-0 right-6 -mt-4">
                  <div className="bg-purple-600 text-white px-3 py-1 text-sm font-semibold tracking-wide uppercase rounded-full shadow-md">
                    Most Popular
                  </div>
                </div>
              )}
              <h3 className="text-2xl font-semibold text-gray-900">{tier.name}</h3>
              <p className="mt-4 flex items-baseline text-gray-900">
                <span className="text-4xl font-extrabold tracking-tight">{formatPrice(tier)}</span>
                {billingPeriodLabel && (
                  <span className="ml-1 text-xl font-semibold">{billingPeriodLabel}</span>
                )}
              </p>
              <p className="mt-4 text-gray-500">
                {tier.description ||
                  (tier.price === 0
                    ? 'Perfect for getting started and small events.'
                    : "Unlock advanced tools to maximize your event's success.")}
              </p>
              <button
                type="button"
                onClick={isFreeTier && onSignUpClick ? onSignUpClick : undefined}
                className={`mt-6 block w-full text-center rounded-md border border-transparent px-5 py-3 text-base font-medium ${
                  tier.isPopular
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                } ${buttonCursorClass}`}
                disabled={buttonDisabled}
              >
                {buttonLabel}
              </button>

              <ul role="list" className="mt-8 space-y-4">
                {features.map((feature) => {
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
                    <span className="ml-3 text-gray-500">
                        <span className="font-medium text-gray-800">{feature}:</span>{' '}
                        {featureValue !== undefined ? `${featureValue}` : 'Not included'}
                    </span>
                  </li>
                );
                })}
              </ul>
            </div>
          );
          })}
        </div>
      </div>
    </div>
  );
};

export default OrganizerTiers;
