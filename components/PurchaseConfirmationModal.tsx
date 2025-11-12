// Updated PurchaseConfirmationModal component integrating Lenco payments.
import React, { useMemo, useState, useEffect } from "react";
import { Event, PaymentDetails, PaymentMethod, Ticket, User } from "../types";
import { formatPrice } from "../utils/tickets";
import { processPayment, getPaymentDetails, savePaymentDetails, verifyPaymentReference } from "../services/paymentService";

interface PurchaseFulfillmentPayload {
  issuedTicket?: Ticket | null;
  existingTicketId?: string | null;
}

interface PurchaseConfirmationModalProps {
  event: Event | null;
  onClose: () => void;
  onPurchaseSuccess: (
    event: Event,
    details: PaymentDetails,
    save: boolean,
    transactionId: string,
    ticketTierId?: string,
    fulfillment?: PurchaseFulfillmentPayload
  ) => void;
  user: User;
}

const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = ['MobileMoney', 'CreditCard'];

const PurchaseConfirmationModal: React.FC<PurchaseConfirmationModalProps> = ({ event, onClose, onPurchaseSuccess, user }) => {
  const [selectedMethods, setSelectedMethods] = useState<PaymentMethod[]>(DEFAULT_PAYMENT_METHODS);
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState('');
  const [saveDetails, setSaveDetails] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [lastReference, setLastReference] = useState<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const savedDetails = getPaymentDetails();
    if (savedDetails?.mobileMoney?.phone) {
      setMobileMoneyPhone(savedDetails.mobileMoney.phone);
    }
  }, []);

  const requiresPhone = useMemo(() => selectedMethods.includes('MobileMoney'), [selectedMethods]);

  if (!event) return null;

  const toggleMethod = (method: PaymentMethod) => {
    setSelectedMethods((prev) =>
      prev.includes(method)
        ? prev.filter((m) => m !== method)
        : [...prev, method]
    );
  };

  // Add state for ticket tier selection
  const [selectedTicketTier, setSelectedTicketTier] = useState<string | null>(null);

  // Initialize selected tier if there are tiers available
  useEffect(() => {
    if (event?.ticketTiers && event.ticketTiers.length > 0) {
      // Default to the first available tier
      setSelectedTicketTier(event.ticketTiers[0].id);
    } else {
      // If no tiers, use null which means the default event price
      setSelectedTicketTier(null);
    }
  }, [event]);

  const selectedTier = event?.ticketTiers?.find(tier => tier.id === selectedTicketTier) || null;
  const currentAmount = selectedTier ? selectedTier.price : event?.price;

  const handleConfirmPurchase = async () => {
    if (selectedMethods.length === 0) {
      setError('Select at least one payment channel.');
      return;
    }
    if (requiresPhone && mobileMoneyPhone.trim().length < 9) {
      setError('Enter a valid mobile number for mobile money payments.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setPendingMessage(null);
    setLastReference(null);

    try {
      const firstName = user.name?.split(' ')[0] ?? user.name;
      const lastName = user.name?.split(' ').slice(1).join(' ') ?? '';
      const result = await processPayment({
        purpose: 'ticket',
        userId: user.id,
        amount: currentAmount,
        currency: 'ZMW',
        eventId: event.id,
        metadata: { 
          eventTitle: event.title, 
          organizerId: event.organizer.id,
          ticketTierId: selectedTicketTier, // Include the selected tier in metadata
          ticketTierName: selectedTier?.name
        },
        paymentMethods: selectedMethods,
        label: `Ticket for ${event.title}${selectedTier ? ` (${selectedTier.name})` : ''}`,
        customer: {
          firstName,
          lastName,
          phone: mobileMoneyPhone || undefined,
        },
      });

      const reference = result.reference;

      if (result.success) {
        setLastReference(null);
        setPendingMessage(null);
        const details: PaymentDetails = mobileMoneyPhone
          ? { mobileMoney: { phone: mobileMoneyPhone } }
          : {};
        if (saveDetails) {
          savePaymentDetails(details);
        }
        const fulfillment = {
          issuedTicket: result.issuedTicket ?? null,
          existingTicketId: (result.transaction as Record<string, unknown> | undefined)?.ticketId as
            | string
            | null
            | undefined,
        };
        onPurchaseSuccess(
          event,
          details,
          saveDetails,
          result.transactionId,
          selectedTicketTier,
          fulfillment
        );
      } else if (result.status === 'pending') {
        setLastReference(reference);
        setError('');
        setPendingMessage(
          `Payment is awaiting confirmation. Your tickets will be issued once confirmed. Reference: ${reference}`
        );
      } else {
        setLastReference(reference);
        setPendingMessage(null);
        setError(`Payment failed. Please try again. Reference: ${reference}`);
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'reference' in err && typeof (err as Record<string, unknown>).reference === 'string') {
        setLastReference((err as Record<string, string>).reference);
      }
      setError(err instanceof Error ? err.message : 'An unexpected error occurred during payment.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 z-[1000] flex justify-center items-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900">Confirm Your Ticket</h2>
              <p className="text-gray-500 mt-1">You're about to purchase a ticket for:</p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4 bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center">
              <img src={event.imageUrl} alt={event.title} className="w-16 h-16 rounded-md object-cover mr-4" />
              <div>
                <h3 className="font-bold text-gray-800">{event.title}</h3>
                <p className="text-sm text-gray-600">{event.location}</p>
                <p className="text-xs text-gray-500">{new Date(event.date).toLocaleString()}</p>
              </div>
              <p className="ml-auto font-bold text-lg text-purple-600">{formatPrice(currentAmount)}</p>
            </div>

            {/* Ticket tier selection */}
            {event.ticketTiers && event.ticketTiers.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Select Ticket Type</h3>
                <div className="space-y-2">
                  {event.ticketTiers.map((tier) => (
                    <label 
                      key={tier.id}
                      className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedTicketTier === tier.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="ticketTier"
                        value={tier.id}
                        checked={selectedTicketTier === tier.id}
                        onChange={() => setSelectedTicketTier(tier.id)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="ml-3 flex-1">
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-gray-800">{tier.name}</span>
                          <span className="font-bold text-purple-600">{formatPrice(tier.price)}</span>
                        </div>
                        {tier.benefits && (
                          <p className="text-xs text-gray-600 mt-1">{tier.benefits}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Choose channels</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => toggleMethod('MobileMoney')}
                  className={`w-full border rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                    selectedMethods.includes('MobileMoney')
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  Mobile Money
                </button>
                <button
                  type="button"
                  onClick={() => toggleMethod('CreditCard')}
                  className={`w-full border rounded-lg px-4 py-3 text-sm font-semibold transition-all ${
                    selectedMethods.includes('CreditCard')
                      ? 'border-purple-500 bg-purple-50 text-purple-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  Card / Bank
                </button>
              </div>
            </div>

            {requiresPhone && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="mobile-money-phone">
                  Mobile number
                </label>
                <input
                  id="mobile-money-phone"
                  type="tel"
                  placeholder="097XXXXXXX"
                  value={mobileMoneyPhone}
                  onChange={(e) => setMobileMoneyPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lenco will use this number to confirm mobile money payments.
                </p>
              </div>
            )}

            <label className="inline-flex items-center text-sm text-gray-600">
              <input
                type="checkbox"
                checked={saveDetails}
                onChange={(e) => setSaveDetails(e.target.checked)}
                className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <span className="ml-2">Remember my contact details for next time.</span>
            </label>
          </div>

          {error && (
            <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
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
                    onClick={async () => {
                      if (!lastReference) return;
                      setIsVerifying(true);
                      setError('');
                      try {
                        const result = await verifyPaymentReference(lastReference);
                        if (result.success) {
                          setPendingMessage(null);
                          setLastReference(null);
                          const details: PaymentDetails = mobileMoneyPhone
                            ? { mobileMoney: { phone: mobileMoneyPhone } }
                            : {};
                          const fulfillment = {
                            issuedTicket: result.issuedTicket ?? null,
                            existingTicketId: (result.transaction as Record<string, unknown> | undefined)?.ticketId as
                              | string
                              | null
                              | undefined,
                          };
                          onPurchaseSuccess(
                            event,
                            details,
                            saveDetails,
                            result.transactionId,
                            selectedTicketTier,
                            fulfillment
                          );
                        } else if (result.status === 'pending') {
                          setPendingMessage(`Payment is still pending confirmation. Reference: ${lastReference}`);
                        } else {
                          setPendingMessage(null);
                          setLastReference(null);
                          setError(
                            `Payment status: ${result.status}. Please try again or contact support with reference ${lastReference}.`
                          );
                        }
                      } catch (err) {
                        setError('Failed to verify payment status. Please try again.');
                      } finally {
                        setIsVerifying(false);
                      }
                    }}
                    disabled={isVerifying}
                    className="inline-flex items-center justify-center rounded-full border border-purple-200 px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isVerifying ? 'Checking status…' : 'Check payment status'}
                  </button>
                  <p className="text-xs text-gray-400">
                    We'll automatically re-check if the payment remains pending.
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t">
          <button
            onClick={handleConfirmPurchase}
            disabled={isProcessing || isVerifying}
            className="w-full bg-purple-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-purple-700 transition-all duration-300 disabled:bg-gray-400 flex justify-center items-center"
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Opening Lenco checkout...
              </>
            ) : (
              `Pay ${formatPrice(currentAmount)} with Lenco`
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseConfirmationModal;
