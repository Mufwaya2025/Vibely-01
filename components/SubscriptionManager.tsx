import React, { useState, useEffect } from 'react';
import { SubscriptionTier } from '../types';
import { getSubscriptionTiers, createSubscriptionTier, updateSubscriptionTier, deleteSubscriptionTier } from '../services/subscriptionService';

interface SubscriptionManagerProps {
  user: { id: string; name: string; email: string; role: string }; // Basic user type for admin
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({ user }) => {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [currentTier, setCurrentTier] = useState<Partial<SubscriptionTier>>({
    name: '',
    description: '',
    price: 0,
    currency: 'ZMW',
    billingPeriod: 'monthly',
    features: {},
    isActive: true,
    maxEvents: 3,
    sortOrder: 0,
  });

  useEffect(() => {
    const fetchTiers = async () => {
      try {
        setLoading(true);
        const fetchedTiers = await getSubscriptionTiers({ scope: 'admin', includeInactive: true });
        setTiers(fetchedTiers);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load subscription tiers');
      } finally {
        setLoading(false);
      }
    };

    fetchTiers();
  }, []);

  const handleEdit = (tier: SubscriptionTier) => {
    setCurrentTier({ ...tier });
    setIsEditing(tier.id);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this subscription tier? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteSubscriptionTier(id);
      const updatedTiers = tiers.filter(tier => tier.id !== id);
      setTiers(updatedTiers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete subscription tier');
    }
  };

  const handleToggleStatus = async (id: string) => {
    const tier = tiers.find(t => t.id === id);
    if (!tier) return;
    
    const updatedTier = { 
      ...tier, 
      isActive: !tier.isActive,
      updatedAt: new Date().toISOString()
    };
    
    try {
      const savedTier = await updateSubscriptionTier(updatedTier);
      const updatedTiers = tiers.map(t => t.id === id ? savedTier : t);
      setTiers(updatedTiers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription tier status');
    }
  };

  const handleSave = async () => {
    try {
      if (isEditing) {
        // Update existing tier
        const updatedTier = await updateSubscriptionTier({
          ...currentTier,
          id: currentTier.id as string
        } as SubscriptionTier);
        
        const updatedTiers = tiers.map(tier => 
          tier.id === updatedTier.id ? updatedTier : tier
        );
        setTiers(updatedTiers);
      } else {
        // Create new tier
        const newTier = await createSubscriptionTier({
          ...currentTier,
          isActive: currentTier.isActive ?? true,
          maxEvents: currentTier.maxEvents,
          sortOrder: currentTier.sortOrder ?? tiers.length,
        } as Omit<SubscriptionTier, 'id' | 'createdAt' | 'updatedAt'>);
        
        setTiers([...tiers, newTier]);
      }
      
      setIsEditing(null);
      setIsCreating(false);
      setCurrentTier({
        name: '',
        description: '',
        price: 0,
        currency: 'ZMW',
        billingPeriod: 'monthly',
        features: {},
        isActive: true,
        maxEvents: 3,
        sortOrder: 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save subscription tier');
    }
  };

  const handleCancel = () => {
    setIsEditing(null);
    setIsCreating(false);
    setCurrentTier({
      name: '',
      description: '',
      price: 0,
      currency: 'ZMW',
      billingPeriod: 'monthly',
      features: {},
      isActive: true,
      maxEvents: 3,
      sortOrder: 0,
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentTier(prev => ({
      ...prev,
      [name]: name === 'price' || name === 'maxEvents' || name === 'sortOrder' ? 
        (name === 'isActive' ? value === 'true' : Number(value)) : value
    }));
  };

  const handleFeatureChange = (feature: string, value: string | boolean) => {
    setCurrentTier(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: value
      }
    }));
  };

  const addFeature = () => {
    const featureName = prompt('Enter feature name:');
    if (featureName) {
      setCurrentTier(prev => ({
        ...prev,
        features: {
          ...prev.features,
          [featureName]: true
        }
      }));
    }
  };

  const removeFeature = (feature: string) => {
    const updatedFeatures = { ...currentTier.features };
    delete updatedFeatures[feature];
    setCurrentTier(prev => ({
      ...prev,
      features: updatedFeatures
    }));
  };

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Subscription Management</h2>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-500">Loading subscription tiers...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Subscription Management</h2>
        </div>
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-500">⚠️</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-800">Subscription Management</h2>
        <button
          onClick={() => {
            setIsCreating(true);
            setIsEditing(null);
            setCurrentTier({
              name: '',
              description: '',
              price: 0,
              currency: 'ZMW',
              billingPeriod: 'monthly',
              features: {},
              isActive: true,
              maxEvents: 3,
              sortOrder: tiers.length,
            });
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        >
          Add New Tier
        </button>
      </div>

      {/* Create/Edit Form */}
      {(isCreating || isEditing) && (
        <div className="mb-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">
            {isEditing ? 'Edit Subscription Tier' : 'Create New Subscription Tier'}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                name="name"
                value={currentTier.name || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (0 for free)</label>
              <input
                type="number"
                name="price"
                value={currentTier.price || 0}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                min="0"
                step="0.01"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <input
                type="text"
                name="currency"
                value={currentTier.currency || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Billing Period</label>
              <select
                name="billingPeriod"
                value={currentTier.billingPeriod || 'monthly'}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="one-time">One-time</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Events (null for unlimited)</label>
              <input
                type="number"
                name="maxEvents"
                value={currentTier.maxEvents ?? ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="Leave blank for unlimited"
                min="0"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <input
                type="number"
                name="sortOrder"
                value={currentTier.sortOrder || 0}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                min="0"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                value={currentTier.description || ''}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={2}
              />
            </div>
            
            <div className="md:col-span-2">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">Features</label>
                <button
                  type="button"
                  onClick={addFeature}
                  className="text-sm text-purple-600 hover:text-purple-800"
                >
                  + Add Feature
                </button>
              </div>
              <div className="space-y-2">
                {Object.entries(currentTier.features || {}).map(([feature, value]) => (
                  <div key={feature} className="flex items-center">
                    <span className="text-sm text-gray-700 w-48 truncate">{feature}:</span>
                    <input
                      type="text"
                      value={typeof value === 'string' ? value : String(value)}
                      onChange={(e) => handleFeatureChange(feature, e.target.value)}
                      className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => removeFeature(feature)}
                      className="ml-2 text-red-500 hover:text-red-700"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="md:col-span-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={currentTier.isActive === true}
                  onChange={(e) => handleInputChange({
                    target: { name: 'isActive', value: e.target.checked }
                  } as unknown as React.ChangeEvent<HTMLInputElement>)}
                  className="h-4 w-4 text-purple-600 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">Active Tier</span>
              </label>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Tier List */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Events</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tiers
              .slice()
              .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
              .map((tier) => (
              <tr key={tier.id} className={tier.isActive ? '' : 'bg-gray-100'}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{tier.name}</div>
                  <div className="text-sm text-gray-500">{tier.description}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {tier.price === 0 ? 'Free' : `${tier.currency} ${tier.price}`}
                    {tier.billingPeriod !== 'one-time' && (
                      <span className="text-xs text-gray-500">/{tier.billingPeriod}</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {tier.maxEvents === null || tier.maxEvents === undefined ? 'Unlimited' : `${tier.maxEvents} events`}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    tier.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {tier.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleEdit(tier)}
                    className="text-indigo-600 hover:text-indigo-900 mr-3"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(tier.id)}
                    className="text-red-600 hover:text-red-900 mr-3"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => handleToggleStatus(tier.id)}
                    className={`${
                      tier.isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                    }`}
                  >
                    {tier.isActive ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SubscriptionManager;
