import React, { useState, useEffect, useMemo } from 'react';
import { Event, User, Ticket, PaymentDetails, AdminStats } from './types';
import { getAllEvents, createEvent } from './services/eventService';
import { getTicketsForUser, createTicket, submitReview } from './services/ticketService';
import { savePaymentDetails, attachTicketToTransaction } from './services/paymentService';
import { getAIRecommendations } from './services/geminiService';
import { addFavoriteEvent, getFavoriteEvents, removeFavoriteEvent } from './services/favoriteService';
import { getCurrentLocation } from './services/locationService';
import { loadLocationFromStorage } from './services/locationPersistenceService';

import Header from './components/Header';
import EventCard from './components/EventCard';
import EventDetailModal from './components/EventDetailModal';
import PurchaseConfirmationModal from './components/PurchaseConfirmationModal';
import LoginModal from './components/LoginModal';
import MyTickets from './components/MyTickets';
import TicketViewModal from './components/TicketViewModal';
import ReviewModal from './components/ReviewModal';
import Toast from './components/Toast';
import ManagerDashboard from './components/ManagerDashboard';
import AdminDashboard from './components/AdminDashboard';
import FilterBar, { Filters } from './components/FilterBar';
import EventMap from './components/EventMap';
import Footer from './components/Footer';
import OrganizerTiers from './components/OrganizerTiers';
import SubscriptionModal from './components/SubscriptionModal';
import Messaging from './components/Messaging';
import { getPlatformStats, getAdminEvents, updateEventStatus, updateEventFeatured } from './services/adminService';
import { loadStoredUser, storeUserSession, clearStoredSession } from './services/sessionService';

const App: React.FC = () => {
  // Global State
  const [user, setUser] = useState<User | null>(() => loadStoredUser());
  const [events, setEvents] = useState<Event[]>([]);
  const [tickets, setTickets] = useState<(Ticket & { event: Event })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string, type: 'success' } | null>(null);

  // Modal State
  const [activeModal, setActiveModal] = useState<'details' | 'purchase' | 'login' | 'myTickets' | 'viewTicket' | 'review' | 'subscription' | 'messaging' | null>(null);
  const [messagingRecipient, setMessagingRecipient] = useState<User | null>(null);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<(Ticket & { event: Event }) | null>(null);

  // Attendee-specific state
  const [recommendedEventIds, setRecommendedEventIds] = useState<string[]>([]);
  const [favoriteEventIds, setFavoriteEventIds] = useState<Set<string>>(new Set());
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [filters, setFilters] = useState<Filters>({
    query: '',
    category: 'All',
    date: 'all',
    price: 'all',
  });
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [isAdminLoading, setIsAdminLoading] = useState(false);
  const [adminEvents, setAdminEvents] = useState<Event[]>([]);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);

  // Fetch initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        const fetchedEvents = await getAllEvents();
        setEvents(fetchedEvents);
        setFavoriteEventIds(getFavoriteEvents());
      } catch (err) {
        setError('Failed to load event data. Please try refreshing the page.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
    
    // Fetch location separately and non-blocking to prevent hanging the app
    const fetchLocation = async () => {
      try {
        const location = await getCurrentLocation();
        setUserLocation(location);
      } catch (err) {
        console.error("Failed to get current location:", err);
        // Don't set an error state for location issues, just try to use stored location
        const storedLocation = loadLocationFromStorage();
        if (storedLocation) {
          setUserLocation(storedLocation);
        } else {
          setUserLocation({ lat: -15.4167, lon: 28.2833 }); // Lusaka coordinates as fallback
        }
      }
    };
    fetchLocation();
  }, []);

  // Fetch user-specific data after login
  useEffect(() => {
    if (user) {
      const fetchUserData = async () => {
        const userTickets = await getTicketsForUser(user.id);
        setTickets(userTickets);
        if (user.role === 'attendee') {
            const recommendations = await getAIRecommendations(user.interests, userTickets.map(t => t.eventId));
            setRecommendedEventIds(recommendations);
        }
      };
      fetchUserData();
    } else {
      setTickets([]);
      setRecommendedEventIds([]);
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAdminStats();
    } else {
      setAdminStats(null);
    }
  }, [user]);

  // Event Handlers
  const handleLoginSuccess = (loggedInUser: User) => {
    setUser(loggedInUser);
    storeUserSession(loggedInUser);
    setToast({ message: `Welcome back, ${loggedInUser.name}!`, type: 'success' });
  };

  const handleSignUpClick = () => {
    setMode('signup');
    setActiveModal('login');
  };

  const handleAdminToggleEventFeatured = async (eventId: string, isFeatured: boolean) => {
    if (!user) return;
    setUpdatingEventId(eventId);
    const updated = await updateEventFeatured(user, eventId, isFeatured);
    if (updated) {
      setAdminEvents(prev =>
        prev.map(evt => (evt.id === eventId ? updated : evt))
      );
      setEvents(prev =>
        prev.map(evt => (evt.id === eventId ? updated : evt))
      );
      setToast({
        message: isFeatured
          ? 'Event featured on landing page.'
          : 'Event removed from featured list.',
        type: 'success',
      });
    } else {
      setToast({ message: 'Failed to update featured state.', type: 'success' });
    }
    setUpdatingEventId(null);
  };

  const handleLogout = () => {
    setUser(null);
    clearStoredSession();
  };
  
  const handleOpenSubscriptionModal = () => {
    if (!user) {
      // If not logged in, show login modal first
      setMode('signup'); // Use signup mode to encourage account creation
      setActiveModal('login');
      return;
    }
    // If user is logged in, open the subscription modal
    setActiveModal('subscription');
  };
  
  const handleSubscriptionSuccess = async (updatedUser: User) => {
    setUser(updatedUser);
    storeUserSession(updatedUser);
    setToast({ message: 'Subscription successfully upgraded to Pro!', type: 'success' });
    
    // Refetch events to update any data related to the user's new subscription tier
    try {
      setIsLoading(true);
      const fetchedEvents = await getAllEvents();
      setEvents(fetchedEvents);
    } catch (err) {
      setError('Failed to refresh events after subscription upgrade.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  const handleSelectEvent = (event: Event) => {
    setSelectedEvent(event);
    setActiveModal('details');
  };

  const handlePurchaseClick = (event: Event) => {
    if (!user) {
      setActiveModal('login');
      return;
    }
    setSelectedEvent(event);
    setActiveModal('purchase');
  };

  const handlePurchaseSuccess = async (
    event: Event,
    details: PaymentDetails,
    shouldSave: boolean,
    transactionId: string
  ) => {
    if (!user) return;
    const newTicket = await createTicket(event, user);
    setTickets(prev => [...prev, { ...newTicket, event }]);
    setActiveModal(null);
    setToast({ message: `Successfully purchased ticket for ${event.title}!`, type: 'success' });
    if (shouldSave) {
        savePaymentDetails(details);
    }
    // Update sold count on the event
    setEvents(prevEvents => prevEvents.map(e => e.id === event.id ? {...e, ticketsSold: (e.ticketsSold || 0) + 1} : e));
    if (transactionId) {
      attachTicketToTransaction(transactionId, newTicket.ticketId);
    }
  };
  
  const handleCreateEvent = async (eventData: Omit<Event, 'id' | 'organizer'>) => {
      if(!user) throw new Error("User not logged in");
      const newEvent = await createEvent(eventData, {id: user.id, name: user.name});
      setEvents(prev => [...prev, newEvent]);
      setToast({ message: `Event "${newEvent.title}" created successfully!`, type: 'success' });
      if (user.role === 'admin') {
        fetchAdminStats();
      }
  };

  const handleEditEvent = async (eventData: Event) => {
      if (!user) throw new Error("User not logged in");
      // The actual event update logic would be implemented here
      // For now, we'll just update the event in the local state
      setEvents(prevEvents => 
        prevEvents.map(e => e.id === eventData.id ? eventData : e)
      );
      setToast({ message: `Event "${eventData.title}" updated successfully!`, type: 'success' });
  };

  const handleAdminUpdateEventStatus = async (eventId: string, status: string) => {
    if (!user) return;
    setUpdatingEventId(eventId);
    const updated = await updateEventStatus(user, eventId, status);
    if (updated) {
      setAdminEvents(prev =>
        prev.map(evt => (evt.id === eventId ? updated : evt))
      );
      setEvents(prev =>
        prev.map(evt => (evt.id === eventId ? updated : evt))
      );
      setToast({ message: `Event status set to ${status}.`, type: 'success' });
    } else {
      setToast({ message: 'Failed to update event status.', type: 'success' });
    }
    setUpdatingEventId(null);
  };

  const fetchAdminStats = async () => {
    if (!user) return;
    setIsAdminLoading(true);
    const [stats, adminEventList] = await Promise.all([
      getPlatformStats(user),
      getAdminEvents(user),
    ]);
    setAdminStats(stats);
    setAdminEvents(adminEventList);
    setIsAdminLoading(false);
  };

  const handleSubmitReview = async (ticketId: string, rating: number, reviewText: string) => {
    const updatedTicket = await submitReview(ticketId, rating, reviewText);
    setTickets(prev => prev.map(t => t.ticketId === ticketId ? { ...t, ...updatedTicket } : t));
    setActiveModal(null);
    setToast({ message: 'Thank you for your review!', type: 'success' });
  };
  
  const handleToggleFavorite = (eventId: string) => {
    const newFavorites = new Set(favoriteEventIds);
    if (newFavorites.has(eventId)) {
        removeFavoriteEvent(eventId);
        newFavorites.delete(eventId);
    } else {
        addFavoriteEvent(eventId);
        newFavorites.add(eventId);
    }
    setFavoriteEventIds(newFavorites);
  };

  const openMessaging = (recipient: User) => {
    setMessagingRecipient(recipient);
    setActiveModal('messaging');
  };

  // Derived State
  const purchasedTicketEventIds = useMemo(() => new Set(tickets.map(t => t.eventId)), [tickets]);
  
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const matchesDatePreset = (eventDate: Date) => {
      switch (filters.date) {
        case 'today':
          return eventDate >= startOfToday && eventDate < endOfToday;
        case 'this_week':
          return eventDate >= startOfWeek && eventDate < endOfWeek;
        case 'this_month':
          return eventDate >= startOfMonth && eventDate < endOfMonth;
        case 'all':
          return true;
        case 'custom':
          return true; // handled via customDate match below
        default:
          // custom ISO date string
          return filters.date === eventDate.toISOString().split('T')[0];
      }
    };

    return events
      .filter((event) => new Date(event.date) > new Date()) // only show future events
      .filter((event) => {
        const eventDate = new Date(event.date);
        const eventDateIso = eventDate.toISOString().split('T')[0];
        const queryMatch =
          event.title.toLowerCase().includes(filters.query.toLowerCase()) ||
          event.description.toLowerCase().includes(filters.query.toLowerCase());
        const categoryMatch = filters.category === 'All' || event.category === filters.category;
        const dateMatch =
          filters.date === 'all'
            ? true
            : ['today', 'this_week', 'this_month'].includes(filters.date)
            ? matchesDatePreset(eventDate)
            : filters.date === eventDateIso;
        return queryMatch && categoryMatch && dateMatch;
      })
      .sort((a, b) => {
        const aIsRecommended = recommendedEventIds.includes(a.id);
        const bIsRecommended = recommendedEventIds.includes(b.id);
        const aIsFavorite = favoriteEventIds.has(a.id);
        const bIsFavorite = favoriteEventIds.has(b.id);

        if (aIsRecommended !== bIsRecommended) return aIsRecommended ? -1 : 1;
        if (aIsFavorite !== bIsFavorite) return aIsFavorite ? -1 : 1;

        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });
  }, [events, filters, recommendedEventIds, favoriteEventIds]);

  const managerEvents = useMemo(() => {
      if(user?.role !== 'manager') return [];
      return events.filter(e => e.organizer.id === user.id)
                   .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events, user]);

  // Render Logic
  if (isLoading) {
    return <div className="min-h-screen bg-gray-100 flex items-center justify-center">Loading...</div>;
  }

  if (error) {
    return <div className="min-h-screen bg-red-50 flex items-center justify-center text-red-700">{error}</div>;
  }
  
  if (user?.role === 'admin') {
      return (
        <AdminDashboard
          user={user}
          stats={adminStats}
          recentEvents={adminStats?.recentEvents ?? []}
          events={adminEvents}
          isLoading={isAdminLoading}
          updatingEventId={updatingEventId}
          onRefresh={fetchAdminStats}
          onLogout={handleLogout}
          onUpdateEventStatus={handleAdminUpdateEventStatus}
          onToggleEventFeatured={handleAdminToggleEventFeatured}
        />
      );
  }

  if (user?.role === 'manager') {
      return (
        <ManagerDashboard 
            user={user} 
            events={managerEvents}
            onCreateEvent={handleCreateEvent}
            onEditEvent={handleEditEvent}
            onSubscriptionSuccess={handleSubscriptionSuccess}
            onLogout={handleLogout}
        />
      );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-900">
      <Header
        user={user}
        onLoginClick={() => setActiveModal('login')}
        onLogout={handleLogout}
        onShowTickets={() => setActiveModal('myTickets')}
        purchasedTicketsCount={tickets.length}
        onOpenMessaging={user ? () => {
          // For now, we'll need to implement a contacts list or direct messaging
          // For demo, let's hardcode a potential contact (the first manager we find)
          // In a real app, this would open a contacts/messaging interface
          const defaultManager = {
            id: 'demo-manager',
            name: 'Demo Manager',
            email: 'demo@manager.com',
            role: 'manager' as const,
            status: 'active' as const,
            interests: [],
            attendedEvents: []
          };
          openMessaging(defaultManager);
        } : undefined}
      />
      
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-10 sm:px-8 lg:px-12 xl:px-16">
        <section className="text-center">
          <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl">Find Your Next Vibe</h1>
          <p className="mt-4 text-lg text-slate-500 sm:text-xl">
            Discover the best events happening in Zambia.
          </p>
        </section>

        <section className="mt-10">
          <FilterBar
            onFilterChange={setFilters}
            filters={filters}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </section>

        <section className="mt-10">
          {filteredEvents.length > 0 ? (
            viewMode === 'list' ? (
              <div className="event-grid gap-6 sm:gap-8">
                {filteredEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onSelect={handleSelectEvent}
                    onPurchase={handlePurchaseClick}
                    isFavorite={favoriteEventIds.has(event.id)}
                    onToggleFavorite={handleToggleFavorite}
                    isPurchased={purchasedTicketEventIds.has(event.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-3xl bg-white shadow-lg">
                <EventMap
                  events={filteredEvents}
                  userLocation={userLocation}
                  onSelectEvent={handleSelectEvent}
                  onPurchase={handlePurchaseClick}
                  purchasedTicketIds={purchasedTicketEventIds}
                />
              </div>
            )
          ) : (
            <div className="rounded-3xl bg-white py-14 px-6 text-center shadow-lg">
              <h3 className="text-xl font-semibold text-slate-900">No events available</h3>
              <p className="mt-2 text-sm text-slate-500">
                {user?.role === 'manager'
                  ? 'Create your first event to get started!'
                  : 'Check back later for upcoming events.'}
              </p>
              {user?.role === 'manager' && (
                <button
                  onClick={() => setViewMode('list')}
                  className="mt-6 inline-flex items-center rounded-full bg-purple-600 px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                >
                  Create Event
                </button>
              )}
            </div>
          )}
        </section>

        <section className="mt-16">
          <div className="overflow-hidden rounded-3xl bg-white shadow-lg ring-1 ring-slate-100">
            <OrganizerTiers onSignUpClick={handleSignUpClick} onUpgradeClick={handleOpenSubscriptionModal} />
          </div>
        </section>
      </main>

      <Footer />

      {/* Modals */}
      {activeModal === 'details' && selectedEvent && user && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setActiveModal(null)}
          onPurchase={handlePurchaseClick}
          isPurchased={purchasedTicketEventIds.has(selectedEvent.id)}
          onMessageOrganizer={(organizer) => openMessaging(organizer)}
        />
      )}
      {activeModal === 'purchase' && selectedEvent && user && (
        <PurchaseConfirmationModal
            event={selectedEvent}
            onClose={() => setActiveModal(null)}
            onPurchaseSuccess={handlePurchaseSuccess}
            user={user}
        />
      )}
      {activeModal === 'login' && <LoginModal onClose={() => setActiveModal(null)} onLoginSuccess={handleLoginSuccess} initialMode={mode} />}
      {activeModal === 'myTickets' && <MyTickets tickets={tickets} onClose={() => setActiveModal(null)} onViewTicket={(ticket) => { setSelectedTicket(ticket); setActiveModal('viewTicket'); }} onLeaveReview={(ticket) => { setSelectedTicket(ticket); setActiveModal('review'); }}/>}
      {activeModal === 'viewTicket' && selectedTicket && <TicketViewModal ticket={selectedTicket} onClose={() => setActiveModal('myTickets')} userLocation={userLocation} />}
      {activeModal === 'review' && selectedTicket && <ReviewModal ticket={selectedTicket} onClose={() => setActiveModal('myTickets')} onSubmit={handleSubmitReview} />}
      {activeModal === 'subscription' && user && (
        <SubscriptionModal 
          user={user} 
          onClose={() => setActiveModal(null)} 
          onSuccess={handleSubscriptionSuccess} 
        />
      )}
      {activeModal === 'messaging' && user && messagingRecipient && (
        <Messaging 
          currentUser={user} 
          recipient={messagingRecipient} 
          onClose={() => setActiveModal(null)} 
        />
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;
