import React, { useState, useEffect } from 'react';
import { User, Transaction, PayoutMethod } from '../types';
import { getFinancialSummary, FinancialSummary, getTransactions } from '../services/financialService';
import { getPayoutMethods, requestPayout } from '../services/walletService';

import AddPayoutMethodModal from './AddPayoutMethodModal';
import Toast from './Toast';

import WalletIcon from './icons/WalletIcon';
import ArrowDownCircleIcon from './icons/ArrowDownCircleIcon';
import ArrowUpRightIcon from './icons/ArrowUpRightIcon';
import ArrowUturnLeftIcon from './icons/ArrowUturnLeftIcon';
import ClockIcon from './icons/ClockIcon';
import PlusCircleIcon from './icons/PlusCircleIcon';
import SendIcon from './icons/SendIcon';
import BankIcon from './icons/BankIcon';
import MobileMoneyIcon from './icons/MobileMoneyIcon';
import CheckCircleIcon from './icons/CheckCircleIcon';

interface RevenueDashboardProps {
  user: User;
}

const formatCurrency = (amount: number, currency = 'ZMW') => {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
  return currency === 'ZMW' ? formatted.replace('ZMW', 'K') : formatted;
};




const RevenueDashboard: React.FC<RevenueDashboardProps> = ({ user }) => {
    const [summary, setSummary] = useState<FinancialSummary | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [payoutMethods, setPayoutMethods] = useState<PayoutMethod[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [isAddMethodModalOpen, setIsAddMethodModalOpen] = useState(false);
    const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
    
    const [toast, setToast] = useState<{ message: string; type: 'success' } | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const [summaryData, transactionsData, methodsData] = await Promise.all([
                    getFinancialSummary(user.id),
                    getTransactions(user.id),
                    getPayoutMethods(user.id)
                ]);
                setSummary(summaryData);
                setTransactions(transactionsData);
                setPayoutMethods(methodsData);
            } catch (error) {
                console.error("Failed to load financial data:", error);
                setToast({ message: 'Failed to load financial data.', type: 'success' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [user.id]);

    const handleAddMethodSuccess = (newMethod: PayoutMethod) => {
        setPayoutMethods(prev => [...prev, newMethod]);
        setToast({ message: 'Payout method added successfully!', type: 'success' });
    };

    const PayoutModal = () => {
        const [amount, setAmount] = useState(0);
        const [selectedMethod, setSelectedMethod] = useState<string>(payoutMethods.find(m => m.isDefault)?.id || '');
        const [isProcessing, setIsProcessing] = useState(false);
        const [error, setError] = useState('');

        const handlePayoutRequest = async () => {
             if (!selectedMethod || amount <= 0) {
                 setError("Please select a method and enter a valid amount.");
                 return;
             }
             if (summary && amount > summary.balance) {
                 setError("Payout amount cannot exceed your available balance.");
                 return;
             }
            setIsProcessing(true);
            setError('');
            try {
                const result = await requestPayout(user.id, amount, selectedMethod);
                if (result.success) {
                    const [updatedSummary, updatedTransactions] = await Promise.all([
                        getFinancialSummary(user.id),
                        getTransactions(user.id),
                    ]);
                    setSummary(updatedSummary);
                    setTransactions(updatedTransactions);
                    setToast({ message: result.message, type: 'success' });
                    setIsPayoutModalOpen(false);
                } else {
                    setError(result.message);
                }
            } catch (e) {
                setError("An unexpected error occurred.");
            } finally {
                setIsProcessing(false);
            }

        }
        return (
             <div className="fixed inset-0 z-[1000] bg-black bg-opacity-75 flex justify-center items-center p-4" onClick={() => setIsPayoutModalOpen(false)}>
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in-up" onClick={e => e.stopPropagation()}>
                    <div className="p-6 border-b">
                        <h2 className="text-xl font-bold text-gray-900">Request Payout</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label htmlFor="payout-amount" className="block text-sm font-medium text-gray-700">Amount (Available: {formatCurrency(summary?.balance || 0, summary?.currency)})</label>
                            <input type="number" id="payout-amount" value={amount} onChange={e => setAmount(Number(e.target.value))} min="1" max={summary?.balance} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" />
                        </div>
                        <div>
                            <label htmlFor="payout-method" className="block text-sm font-medium text-gray-700">Payout to</label>
                            <select id="payout-method" value={selectedMethod} onChange={e => setSelectedMethod(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500">
                                <option value="">Select a method</option>
                                {payoutMethods.map(m => <option key={m.id} value={m.id}>{m.details}</option>)}
                            </select>
                        </div>
                        {error && <p className="text-sm text-red-600">{error}</p>}
                    </div>
                    <div className="p-4 bg-gray-50 border-t flex justify-end space-x-2">
                        <button type="button" onClick={() => setIsPayoutModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
                        <button onClick={handlePayoutRequest} disabled={isProcessing} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 disabled:bg-gray-400">
                           {isProcessing ? 'Processing...' : 'Request Payout'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (isLoading) {
        return <div className="p-8 text-center">Loading financial data...</div>;
    }

    if (!summary) {
        return <div className="p-8 text-center text-red-600">Could not load financial data.</div>;
    }

    const transactionIcons: { [key in Transaction['type']]: React.ReactNode } = {
        Sale: <ArrowDownCircleIcon className="w-6 h-6 text-green-500" />,
        Payout: <ArrowUpRightIcon className="w-6 h-6 text-blue-500" />,
        Fee: <ClockIcon className="w-6 h-6 text-gray-400" />,
        Refund: <ArrowUturnLeftIcon className="w-6 h-6 text-yellow-500" />,
    };

    return (
        <div className="space-y-10 lg:space-y-12">
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                <StatCard title="Total Revenue" value={formatCurrency(summary.totalRevenue, summary.currency)} />
                <StatCard title="Available Balance" value={formatCurrency(summary.balance, summary.currency)} />
                <StatCard title="Pending Payouts" value={formatCurrency(summary.pendingPayouts, summary.currency)} />
                <StatCard
                  title="Last Payout"
                  value={
                    summary.lastPayout
                      ? formatCurrency(summary.lastPayout.amount, summary.currency)
                      : 'No payouts yet'
                  }
                  subtext={
                    summary.lastPayout
                      ? `on ${new Date(summary.lastPayout.date).toLocaleDateString()}`
                      : undefined
                  }
                />
            </div>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.9fr)] xl:gap-12">
                {/* Transactions */}
                <div className="space-y-8 lg:pr-6 xl:pr-10">
                    <div className="bg-white p-6 sm:p-7 rounded-2xl shadow-sm border border-slate-100">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Transactions</h2>
                        <div className="flow-root">
                            <ul className="-my-4 divide-y divide-gray-200">
                                {transactions.map(tx => (
                                    <li key={tx.id} className="flex items-center py-4 space-x-4">
                                        <div className="flex-shrink-0">{transactionIcons[tx.type]}</div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{tx.type} {tx.eventTitle ? `- ${tx.eventTitle}` : ''}</p>
                                            <p className="text-sm text-gray-500 truncate">{tx.description}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-gray-800'}`}>{formatCurrency(tx.amount, summary?.currency ?? 'ZMW')}</p>
                                            <p className="text-xs text-gray-400">{new Date(tx.date).toLocaleDateString()}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Wallet & Payouts */}
                <div className="space-y-8">
                    <div className="bg-white px-6 py-7 sm:px-7 sm:py-8 rounded-2xl shadow-sm border border-slate-100">
                        <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                            <WalletIcon className="w-6 h-6 mr-2" /> Wallet
                        </h2>
                        <div className="text-center bg-purple-50 p-6 rounded-lg">
                            <p className="text-sm text-purple-800">Available for Payout</p>
                            <p className="text-4xl font-bold text-purple-900 mt-1">{formatCurrency(summary.balance, summary.currency)}</p>
                        </div>
                         <button
                            onClick={() => setIsPayoutModalOpen(true)}
                            className="mt-4 w-full flex items-center justify-center px-4 py-3 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors shadow-sm disabled:bg-gray-400"
                            disabled={summary.balance <= 0}
                         >
                            <SendIcon className="w-5 h-5 mr-2" /> Request Payout
                        </button>
                    </div>
                    <div className="bg-white px-6 py-7 sm:px-7 sm:py-8 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-semibold text-gray-800">Payout Methods</h2>
                            <button onClick={() => setIsAddMethodModalOpen(true)} className="p-1 text-purple-600 hover:bg-purple-100 rounded-full">
                                <PlusCircleIcon className="w-7 h-7" />
                            </button>
                        </div>
                        <ul className="space-y-3">
                            {payoutMethods.map(method => (
                                <li key={method.id} className="p-3 border rounded-lg flex items-center">
                                    {method.type === 'Bank' ? <BankIcon className="w-6 h-6 mr-3 text-gray-400" /> : <MobileMoneyIcon className="w-6 h-6 mr-3 text-gray-400" />}
                                    <div className="flex-grow">
                                        <p className="font-medium text-sm text-gray-800">{method.details}</p>
                                        <p className="text-xs text-gray-500">{method.accountInfo}</p>
                                    </div>
                                    {method.isDefault && <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Default</span>}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {isAddMethodModalOpen && <AddPayoutMethodModal user={user} onClose={() => setIsAddMethodModalOpen(false)} onSuccess={handleAddMethodSuccess} />}
            {isPayoutModalOpen && <PayoutModal />}
        </div>
    );
};

const StatCard: React.FC<{ title: string; value: string | number; subtext?: string }> = ({ title, value, subtext }) => (
    <div className="bg-white p-6 rounded-xl shadow-sm space-y-3">
        <p className="text-sm font-medium text-gray-500 truncate">{title}</p>
        <p className="text-3xl font-semibold text-gray-900">{value}</p>
        {subtext && <p className="text-xs text-gray-400 pt-1">{subtext}</p>}
    </div>
);


export default RevenueDashboard;

