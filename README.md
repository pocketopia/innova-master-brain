# Innova Master Brain Engine v5.0.4

A production-grade, multi-tenant Web3/Next-Gen media platform powered by a unified Node.js/Express backend and React 19 + Tailwind v4 + Vite frontend.

## 🏗️ Architecture Overview

The Innova Ecosystem dynamically serves **5 distinct brands (tenants)** from a single codebase:

| Tenant | Description | Theme Color |
|--------|-------------|-------------|
| **MVN** | Music Video Network - Artist distribution & rotation | Rose (#F43F5E) |
| **StreamShare** | Decentralized social content & short-form media | Amber (#F59E0B) |
| **ArcHaven** | Exclusive creator content & sanctuary media | Indigo (#6366F1) |
| **HekticTV** | Live broadcasting & high-bandwidth streaming | Lime (#84CC16) |
| **Kreation** | Interactive gaming & world-building platform | Cyan (#06B6D4) |

## 🔐 Security Model: @USER.NAME Decentralized Identity

**NO legacy authentication** - No email/password, JWT, or OAuth.

Authentication is handled via:
1. **@USER.NAME** decentralized node tag (e.g., `@creator_alpha`)
2. **Ring Comm** P2P hardware signature (encrypted device verification)
3. **Wallet binding** (EVM-compatible address)

## 🤖 AI Moderation

All user-generated content passes through **Google GenAI (gemini-2.5-flash)** before database storage:
- Illegal content detection
- Hate speech & harassment filtering
- Toxic content blocking
- Tenant-specific policy enforcement

## 📁 Project Structure

```
master-brain-engine/
├── server.ts              # Express backend with multi-tenant bridge
├── firestore.rules        # Firebase security rules for tenant isolation
├── package.json           # Dependencies & scripts
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite bundler configuration
├── .env.example           # Environment variables template
├── src/
│   ├── main.tsx           # React entry point
│   ├── App.tsx            # Main application component
│   ├── index.css          # Tailwind v4 with dynamic theming
│   ├── firebase.ts        # Firebase client configuration
│   └── context/
│       └── TenantProvider.tsx  # Multi-tenant context & theming
└── dist/                  # Production build output
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Google GenAI API key (optional, for AI moderation)
- Firebase project (optional, for database)

### Installation

```bash
# Clone or navigate to the project
cd desktop/apps/Innova/code/master-brain-engine

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Required: GEMINI_API_KEY (for AI moderation)
# Optional: Firebase credentials (for database)

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Start production server
npm start
```

## 🌐 Multi-Tenant Bridge

The Express backend uses the `x-tenant-id` header to route requests:

```typescript
// Frontend: Set tenant context
const headers = {
  'x-tenant-id': 'Kreation'
};

fetch('/api/content', { headers })
  .then(res => res.json())
  .then(data => console.log(data));
```

```typescript
// Backend: Multi-tenant middleware automatically:
// 1. Validates tenant ID
// 2. Attaches tenant config to request
// 3. Sets response headers for client theming
// 4. Scopes database queries to tenant context
```

## 🎨 Dynamic Theming (Tailwind v4)

The TenantProvider injects CSS variables that are used by Tailwind:

```css
/* In index.css */
@theme {
  --color-tenant-primary: #F43F5E;    /* Default: MVN Rose */
  --color-tenant-secondary: #E11D48;
  --color-tenant-accent: #FB7185;
}

/* Components use CSS variables */
.btn-primary {
  background-color: var(--tenant-primary);
}
```

When switching tenants, the TenantProvider updates these variables, and all components automatically adopt the new branding.

## 🔒 Firebase Security Rules

The `firestore.rules` file enforces:

1. **Tenant Isolation**: All documents require a `tenantId` field
2. **User Ownership**: Users can only modify their own content
3. **Cross-Tenant Blocking**: Data bleed between tenants is prevented
4. **Moderation Enforcement**: Only approved content can be created

### Collection Schema

```typescript
// Users
{
  userName: "@creator_alpha",      // @USER.NAME tag
  walletAddress: "0x...",           // EVM address
  tier: "Premium",                  // Free, Local, Premium, Creator
  tenants: {                         // Tenant permissions
    MVN: ["read", "write", "publish"]
  }
}

// Media (unified for all tenants)
{
  tenantId: "Kreation",             // Required
  ownerId: "wallet_0x...",          // Content owner
  title: "Retro Runner",
  type: "game_build",
  status: "approved",
  moderationApproved: true,         // AI moderation result
  metadata: { /* tenant-specific */ }
}

// Comments
{
  tenantId: "HekticTV",
  authorId: "wallet_0x...",
  text: "Great stream!",
  moderationApproved: true
}
```

## 📡 API Reference

### Health Check
```
GET /api/health
```

### Get Tenant Content
```
GET /api/content
Headers: x-tenant-id: MVN
```

### Create Content (with AI moderation)
```
POST /api/content
Headers:
  x-tenant-id: Kreation
  x-user-name: @creator_alpha
  x-hardware-signature: ringcomm_...
  x-wallet-address: 0x...
  x-public-key: ...

Body:
{
  title: "My Game",
  type: "game_build",
  buildData: { ... }
}
```

### Post Comment (with AI moderation)
```
POST /api/comments
Headers: (same as above)

Body:
{
  text: "Amazing content!",
  mediaId: "media_123"
}
```

### Get Identity
```
GET /api/identity
Headers: (identity headers)
```

### List Tenants
```
GET /api/tenants
```

## 🛠️ Development

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server (Vite HMR + Express) |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm start` | Start production server |
| `npm run clean` | Remove build output |
| `npm run lint` | TypeScript type checking |

### Testing AI Moderation

The moderation middleware can be tested by sending content with flagged keywords:

```bash
curl -X POST http://localhost:3000/api/content \
  -H "x-tenant-id: MVN" \
  -H "x-user-name: @testuser" \
  -H "x-hardware-signature: ringcomm_test" \
  -H "x-wallet-address: 0x1234567890123456789012345678901234567890" \
  -H "x-public-key: testkey" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","type":"video","text":"This contains illegal content"}'
```

## 📱 Frontend Components

### TenantProvider
```tsx
import { TenantProvider, useTenant, TenantSwitcher } from './context/TenantProvider';

function App() {
  return (
    <TenantProvider defaultTenant="MVN">
      <MyComponent />
    </TenantProvider>
  );
}

function MyComponent() {
  const { currentTenant, setTenant, isTenant } = useTenant();
  
  return (
    <div>
      <h1>{currentTenant?.name}</h1>
      <TenantSwitcher />
    </div>
  );
}
```

### CSS Variables
```css
/* Use in your components */
.element {
  background: var(--tenant-primary);
  color: var(--tenant-accent);
  border-radius: var(--radius-tenant);
  font-family: var(--font-tenant);
}
```

## 🔮 Production Deployment

### Environment Variables

Required for production:
- `NODE_ENV=production`
- `GEMINI_API_KEY` - Google GenAI API key
- `FIREBASE_PROJECT_ID` - Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Service account email
- `FIREBASE_PRIVATE_KEY` - Service account private key

### Firebase Deployment

1. Deploy security rules:
```bash
firebase deploy --only firestore:rules
```

2. Set up Firebase Admin SDK credentials in your hosting environment.

### Vercel / Netlify

The application can be deployed to Vercel or Netlify with the following configuration:

- Build command: `npm run build`
- Output directory: `dist`
- Install command: `npm install`

## 📄 License

Proprietary - Innova Ecosystem. All rights reserved.

## 🤝 Support

For technical support and questions:
- Documentation: [Internal Wiki]
- Issues: [Internal Issue Tracker]
- Email: engineering@innova.io

---

**Innova Master Brain Engine v5.0.4**  
*Decentralized Multi-Tenant Media Platform*