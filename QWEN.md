# Vibely - Event Management Platform

## Project Overview

Vibely is a full-stack event management and ticketing platform built with React and TypeScript on the frontend, and Express.js on the backend. The platform enables users to discover events in Zambia, purchase tickets, and allows event organizers to manage their events. It features role-based access (attendees, managers, and admins), AI-powered event recommendations, payment processing via Lenco, and Google OAuth integration.

### Key Features
- **Event Discovery**: Browse, search, and filter events by category, date, and location
- **Ticket Management**: Purchase tickets and manage your ticket collection
- **Event Creation**: Event organizers can create and manage their events
- **Payment Processing**: Integrated with Lenco for secure payment processing
- **Subscription Tiers**: Pro subscription model for organizers with enhanced features
- **AI Recommendations**: Personalized event recommendations based on user interests
- **QR Code Ticketing**: Digital tickets with QR codes for scanning at events
- **Admin Dashboard**: Comprehensive admin tools for platform management
- **Geolocation Services**: Map-based event discovery using Leaflet

### Architecture
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Authentication**: Google OAuth and local authentication
- **Database**: JSON-based file storage (users in data/users.json)
- **Payment Gateway**: Lenco API integration
- **Styling**: Tailwind CSS with custom UI components

## Building and Running

### Prerequisites
- Node.js (v18+ recommended)
- npm or pnpm

### Setup Instructions

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Environment Configuration**:
   Create a `.env` file based on `.env.example` with the following variables:
   - `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` – Google OAuth 2.0 client for one-click auth
   - `LENCO_PUBLIC_KEY` - Lenco publishable key used by the inline checkout widget
   - `LENCO_SECRET_KEY` - Lenco secret/API token used on the server for verification
   - `VITE_API_BASE_URL` - URL of the Express backend (http://localhost:4000 in local dev)

3. **Run the Backend**:
   ```bash
   pnpm run server:dev
   ```

4. **Run the Frontend**:
   ```bash
   pnpm run dev
   ```

5. **Access the Application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000

### Production Build
To build the application for production:
```bash
pnpm run build
```

## Development Conventions

### Project Structure
```
Vibely/
├── api/                    # API handler functions
├── components/            # React UI components
├── data/                 # Static data files
├── server/               # Backend Express application
├── services/             # Client-side service functions
├── src/                  # Additional source code
├── types.ts             # TypeScript type definitions
├── App.tsx              # Main application component
├── index.tsx            # Application entry point
└── ...
```

### Backend Structure
```
server/
├── config/               # Configuration files
├── middleware/           # Express middleware
├── routes/              # Route registration
├── services/            # Business logic
├── storage/             # Data storage utilities
├── types/               # Backend type definitions
├── utils/               # Utility functions
└── index.ts            # Server entry point
```

### Code Style
- TypeScript is used throughout the application
- React components follow functional component patterns with hooks
- Tailwind CSS for styling with utility-first approach
- Asynchronous operations use async/await pattern
- Components are organized in the `components/` directory
- API calls are abstracted in the `services/` directory
- Type safety is enforced through TypeScript interfaces in `types.ts`

### Authentication
- JWT-based authentication with role-based access control
- Google OAuth integration via `@react-oauth/google`
- User roles: attendee, manager, admin
- Subscription tiers (Regular/Pro) for account management

### Payment System
- Integration with Lenco payment gateway
- Support for both ticket purchases and subscription upgrades
- Webhook handling for payment confirmations
- Payout system for event organizers

## API Endpoints

The backend provides a comprehensive REST API under the `/api` prefix:

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/google` - Google OAuth login

### Events
- `GET /api/events` - Get all events
- `POST /api/events` - Create new event
- `PUT /api/events/:id` - Update event

### Tickets
- `GET /api/tickets` - Get tickets for current user
- `POST /api/tickets` - Create ticket (purchase)
- `POST /api/tickets/review` - Submit event review
- `POST /api/tickets/scan` - Scan ticket QR code

### Payments
- `POST /api/payments/session` - Create payment session
- `POST /api/payments/verify` - Verify payment
- `POST /api/payments/payouts` - Initiate organizer payout
- `GET /api/payments/organizers/:organizerId/balance` - Get organizer balance

### Subscriptions
- `POST /api/subscriptions/upgrade` - Upgrade subscription
- `DELETE /api/subscriptions` - Cancel subscription
- `GET /api/subscriptions/tiers` - Get available subscription tiers

### Admin Endpoints
- `GET /api/admin/stats` - Platform statistics
- `GET /api/admin/users` - Manage users
- `POST /api/admin/users/:id/role` - Update user role
- `GET /api/admin/payments/transactions` - View payment transactions
- `GET /api/admin/settings/platform` - Platform settings

### External Integrations
- Google Maps API for location services
- Lenco API for payment processing
- Google OAuth for user authentication
- Leaflet for map visualization

## Testing

While specific test files weren't visible during analysis, following standard practices for React/TypeScript projects would involve:
- Jest and React Testing Library for frontend component testing
- Supertest for backend API endpoint testing
- Integration tests for external API calls (Google, Lenco)

## Deployment

The application appears to be configured for deployment with:
- Modern build system using Vite
- Proper environment variable handling
- CSP headers for security
- JSON-based storage solution that can be swapped with a managed database in production

## Notes

- The application uses JSON file-based storage (`data/users.json`) for user data, which should be swapped for a proper database in production
- Payment processing is handled through the Lenco API (Zambian payment gateway)
- The application has a sophisticated subscription model for organizers
- Super admin account is created on first run with email `mufwaya.zm@gmail.com` and password `ew0fwcxs`
- The project includes comprehensive admin tools for platform management
- AI recommendations are implemented to suggest relevant events to users