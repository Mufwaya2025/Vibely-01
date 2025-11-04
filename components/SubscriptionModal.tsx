import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User, SubscriptionTier } from '../types';
import { upgradeToPro } from '../services/subscriptionService';
import { verifyPaymentReference } from '../services/paymentService';

interface SubscriptionModalProps {
  user: User;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
  subscriptionTiers: SubscriptionTier[];
  isLoadingTiers: boolean;
  tiersError: string | null;
}

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  user,
  onClose,
  onSuccess,
  subscriptionTiers,
  isLoadingTiers,
  tiersError,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [lastReference, setLastReference] = useState<string | null>(null);

  const activeTiers = useMemo(
    () => subscriptionTiers.filter((tier) => tier.isActive),
    [subscriptionTiers]
  );

  const upgradeTier = useMemo(() => {
    if (activeTiers.length === 0) return null;
    const target = activeTiers.find(
      (tier) => tier.name.toLowerCase() === 'pro'
    );
    if (target) return target;
    const current = user.subscriptionTier ?? 'Regular';
    return (
      activeTiers.find((tier) => tier.name !== current) ?? activeTiers[0]
    );
  }, [activeTiers, user.subscriptionTier]);

  const formattedPrice = useMemo(() => {
    if (!upgradeTier) return null;
    if (upgradeTier.price === 0) return 'Free';
    try {
      return new Intl.NumberFormat('en-ZM', {
        style: 'currency',
        currency: upgradeTier.currency,
        minimumFractionDigits: upgradeTier.price % 1 === 0 ? 0 : 2,
      }).format(upgradeTier.price);
    } catch {
      return `${upgradeTier.currency} ${upgradeTier.price}`;
    }
  }, [upgradeTier]);

  const billingPeriodLabel = useMemo(() => {
    if (!upgradeTier) return null;
    switch (upgradeTier.billingPeriod) {
      case 'monthly':
        return 'per month';
      case 'yearly':
        return 'per year';
      case 'one-time':
      default:
        return 'one-time payment';
    }
  }, [upgradeTier]);

  const handleUpgrade = async () => {
    if (!upgradeTier) {
      setError('No active subscription tier is available at the moment. Please contact support.');
      return;
    }
    if (
      typeof upgradeTier.price !== 'number' ||
      Number.isNaN(upgradeTier.price) ||
      upgradeTier.price <= 0
    ) {
      setError('The selected subscription tier is not billable. Please choose a different plan.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setPendingMessage(null);
    setLastReference(null);

    try {
      const result = await upgradeToPro({ user, tier: upgradeTier });
      const reference = result.reference;

      if (result.success) {
        const updatedUser = result.updatedUser ?? {
          ...user,
          subscriptionTier: 'Pro',
        };
        onSuccess(updatedUser);
        onClose();
      } else if (result.status === 'pending') {
        setLastReference(reference);
        setPendingMessage('Payment confirmation is pending. Your account will upgrade automatically once the payment succeeds.');
      } else {
        setLastReference(reference);
        setError(`Payment was not completed. Please try again. Reference: ${reference}`);
      }
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'reference' in err &&
        typeof (err as Record<string, unknown>).reference === 'string'
      ) {
        setLastReference((err as Record<string, string>).reference);
      }
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStatusCheck = useCallback(async () => {
    if (!lastReference || isVerifying) {
      return;
    }
    setIsVerifying(true);
    setError(null);

    try {
      const verification = await verifyPaymentReference(lastReference);
      if (verification.success) {
        const updatedUser = verification.updatedUser ?? {
          ...user,
          subscriptionTier: 'Pro',
        };
        onSuccess(updatedUser);
        onClose();
      } else if (verification.status === 'pending') {
        setPendingMessage('Payment confirmation is still pending. Your account will upgrade automatically once the payment succeeds.');
      } else {
        setPendingMessage(null);
        setError(`Payment status: ${verification.status}. Reference: ${verification.reference}`);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to verify payment status. Reference: ${lastReference}`
      );
    } finally {
      setIsVerifying(false);
    }
  }, [isVerifying, lastReference, onClose, onSuccess, user]);

  useEffect(() => {
    if (!lastReference || !pendingMessage) {
      return;
    }
    const timer = window.setTimeout(() => {
      void handleStatusCheck();
    }, 60000);
    return () => window.clearTimeout(timer);
  }, [handleStatusCheck, lastReference, pendingMessage]);

  const isUpgradeDisabled =
    isProcessing ||
    isVerifying ||
    isLoadingTiers ||
    !upgradeTier ||
    typeof upgradeTier.price !== 'number' ||
    Number.isNaN(upgradeTier.price) ||
    upgradeTier.price <= 0;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-[1000] flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Upgrade to Pro</h2>
            <p className="mt-2 text-gray-500">Unlock all features and create unlimited events.</p>
          </div>

          <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
            <p className="text-purple-800 font-semibold">
              {upgradeTier?.name ?? 'Pro Plan'}
            </p>
            {isLoadingTiers ? (
              <p className="text-sm text-purple-700">Loading pricing...</p>
            ) : upgradeTier ? (
              <>
                <p className="text-4xl font-extrabold text-purple-900 mt-1">
                  {formattedPrice}
                </p>
                {billingPeriodLabel && (
                  <p className="text-sm text-purple-700">{billingPeriodLabel}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-purple-700">
                Pricing information is currently unavailable.
              </p>
            )}
            {tiersError && (
              <p className="mt-2 text-xs text-red-600">{tiersError}</p>
            )}
          </div>

          <div className="mt-6 text-gray-600 text-sm">
            Payments are securely processed in ZMW via the Lenco checkout. You will be redirected to
            confirm the subscription and we will update your account automatically once the payment is
            successful.
          </div>

          {error && (
            <div className="mt-4 text-sm text-red-600 text-center">
              <p>{error}</p>
              {lastReference && (
                <p className="mt-1 text-xs text-gray-500">
                  Reference:&nbsp;
                  <code className="font-mono text-gray-700 bg-gray-100 px-1 py-0.5 rounded">
                    {lastReference}
                  </code>
                </p>
              )}
            </div>
          )}

          {!error && pendingMessage && (
            <div className="mt-4 text-center space-y-2">
              <p className="text-sm text-purple-700">{pendingMessage}</p>
              {lastReference && (
                <>
                  <p className="text-xs text-gray-500">
                    Reference:&nbsp;
                    <code className="font-mono text-gray-700 bg-gray-100 px-1 py-0.5 rounded">
                      {lastReference}
                    </code>
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleStatusCheck()}
                    disabled={isVerifying}
                    className="inline-flex items-center justify-center rounded-full border border-purple-200 px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isVerifying ? (
                      <>
                        <svg
                          className="mr-2 h-4 w-4 animate-spin text-purple-600"
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Checking…
                      </>
                    ) : (
                      'Check payment status'
                    )}
                  </button>
                  <p className="text-xs text-gray-400">
                    We’ll automatically re-check if the payment remains pending.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t">
          <button
            onClick={handleUpgrade}
            disabled={isUpgradeDisabled}
            className="w-full bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-700 transition-all duration-300 disabled:bg-gray-400 flex justify-center items-center"
          >
            {isProcessing ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing via Lenco...
              </>
            ) : (
              'Pay with Lenco'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionModal;
