import React, { useState } from 'react';
import { PayoutMethod } from '../types';
import { addPayoutMethod } from '../services/walletService';
import BankIcon from './icons/BankIcon';
import MobileMoneyIcon from './icons/MobileMoneyIcon';

interface AddPayoutMethodModalProps {
  user: { id: string };
  onClose: () => void;
  onSuccess: (newMethod: PayoutMethod) => void;
}

const AddPayoutMethodModal: React.FC<AddPayoutMethodModalProps> = ({ user, onClose, onSuccess }) => {
  const [methodType, setMethodType] = useState<'Bank' | 'MobileMoney'>('Bank');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [mobileMoneyProvider, setMobileMoneyProvider] = useState('MTN');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const newMethodData: Omit<PayoutMethod, 'id' | 'isDefault'> = methodType === 'Bank'
        ? { type: 'Bank', details: `${bankName} - **** ${accountNumber.slice(-4)}`, accountInfo: accountHolder }
        : { type: 'MobileMoney', details: `${mobileMoneyProvider} - ${phoneNumber.slice(0, 3)}...${phoneNumber.slice(-2)}`, accountInfo: accountHolder };
      
      const result = await addPayoutMethod(user.id, newMethodData);
      onSuccess(result);
      onClose();
    } catch (err) {
      setError('Failed to add payout method. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const isFormValid = accountHolder && (
    (methodType === 'Bank' && accountNumber && bankName) || 
    (methodType === 'MobileMoney' && phoneNumber && mobileMoneyProvider)
  );

  return (
    <div className="fixed inset-0 z-[1000] bg-black bg-opacity-75 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in-up" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Add Payout Method</h2>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Method Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setMethodType('Bank')} className={`flex items-center justify-center p-3 border rounded-lg ${methodType === 'Bank' ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500' : 'border-gray-300'}`}>
                  <BankIcon className="w-5 h-5 mr-2" /> Bank
                </button>
                <button type="button" onClick={() => setMethodType('MobileMoney')} className={`flex items-center justify-center p-3 border rounded-lg ${methodType === 'MobileMoney' ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500' : 'border-gray-300'}`}>
                  <MobileMoneyIcon className="w-5 h-5 mr-2" /> Mobile Money
                </button>
              </div>
            </div>
            {methodType === 'Bank' ? (
              <>
                <div>
                  <label htmlFor="bankName" className="block text-sm font-medium text-gray-700">Bank Name</label>
                  <input type="text" id="bankName" value={bankName} onChange={e => setBankName(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" />
                </div>
                <div>
                  <label htmlFor="accountHolder" className="block text-sm font-medium text-gray-700">Account Holder Name</label>
                  <input type="text" id="accountHolder" value={accountHolder} onChange={e => setAccountHolder(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" />
                </div>
                <div>
                  <label htmlFor="accountNumber" className="block text-sm font-medium text-gray-700">Account Number</label>
                  <input type="text" id="accountNumber" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" />
                </div>
              </>
            ) : (
              <>
                 <div>
                  <label htmlFor="mmProvider" className="block text-sm font-medium text-gray-700">Provider</label>
                  <select id="mmProvider" value={mobileMoneyProvider} onChange={e => setMobileMoneyProvider(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500">
                      <option>MTN</option>
                      <option>Airtel</option>
                      <option>Zamtel</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="mmAccountHolder" className="block text-sm font-medium text-gray-700">Account Holder Name</label>
                  <input type="text" id="mmAccountHolder" value={accountHolder} onChange={e => setAccountHolder(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" />
                </div>
                 <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">Phone Number</label>
                  <input type="tel" id="phoneNumber" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} required className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500" />
                </div>
              </>
            )}
             {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="p-4 bg-gray-50 border-t flex justify-end space-x-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={!isFormValid || isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-purple-600 border border-transparent rounded-md hover:bg-purple-700 disabled:bg-gray-400">
                {isSubmitting ? 'Saving...' : 'Save Method'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPayoutMethodModal;