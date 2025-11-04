import { Transaction } from '../types';
import { apiFetchJson } from '../utils/apiClient';

export interface FinancialSummary {
  totalRevenue: number;
  pendingPayouts: number;
  lastPayout: {
    amount: number;
    date: string;
  } | null;
  balance: number;
  currency: string;
}

export const getFinancialSummary = async (userId: string): Promise<FinancialSummary> => {
  const [balance, transactionsResponse] = await Promise.all([
    apiFetchJson<{
      organizerId: string;
      currency: string;
      totals: {
        gross: number;
        lencoFees: number;
        platformFees: number;
        paidOut: number;
        pendingPayouts: number;
      };
      availableBalance: number;
    }>(`/api/payments/organizers/${userId}/balance`),
    apiFetchJson<{ data: Transaction[] }>(`/api/payments/organizers/${userId}/transactions?limit=10`),
  ]);

  const lastPayout = transactionsResponse.data.find((txn) => txn.type === 'Payout') ?? null;

  return {
    totalRevenue: balance.totals.gross,
    pendingPayouts: balance.totals.pendingPayouts,
    lastPayout: lastPayout
      ? {
          amount: lastPayout.amount,
          date: lastPayout.date,
        }
      : null,
    balance: balance.availableBalance,
    currency: balance.currency,
  };
};

export const getTransactions = async (userId: string): Promise<Transaction[]> => {
  const response = await apiFetchJson<{ data: Transaction[] }>(
    `/api/payments/organizers/${userId}/transactions`
  );
  return response.data;
};
