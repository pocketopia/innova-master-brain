# Innova Master Brain Engine v5.0.4 - Complete Code Export

This directory contains the complete production-grade boilerplate for the Innova Ecosystem - a multi-tenant Web3 media platform.

## 📁 Project Structure

```
master-brain-engine/
├── server.ts                    # Express backend with multi-tenant bridge
├── src/
│   ├── routes/
│   │   ├── identity.ts          # @USER.NAME decentralized identity routes
│   │   └── wallet.ts            # Cross-chain wallet transaction routes
│   ├── context/
│   │   └── TenantProvider.tsx   # React 19 multi-tenant context
│   ├── App.tsx                  # Main application component
│   ├── main.tsx                 # React entry point
│   ├── index.css                # Tailwind v4 with dynamic theming
│   └── firebase.ts              # Firebase client config
├── firestore.rules              # Firebase security rules
├── package.json                 # Dependencies
├── tsconfig.json                # TypeScript config
├── vite.config.ts               # Vite bundler config
├── .env.example                 # Environment variables template
└── README.md                    # Documentation
```

## 🔐 Security Features Implemented

### 1. Identity Middleware (PATCHED)
- Public keys retrieved from Firestore, NOT from request headers
- Prevents public key spoofing attacks
- Hardware signature verification against stored keys

### 2. Firebase Custom Token Minting
- Tokens minted after successful verification
- Frontend uses `signInWithCustomToken()` for real-time auth
- Security rules enforcement for subscriptions

### 3. Web3 Wallet Scaffolding
- ethers.js v6 ready imports
- Chain configs for all 5 tenants:
  - MVN: Ethereum Mainnet
  - StreamShare: Polygon
  - ArcHaven: Arbitrum
  - HekticTV: Optimism
  - Kreation: Base

### 4. Cross-Tenant Data Integrity
- All writes include explicit `tenantId` field
- Firestore security rules enforce isolation

## 🚀 Quick Start

### 1. Copy to New Directory
```bash
cp -r master-brain-engine /your/new/location/
cd /your/new/location/master-brain-engine
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your API keys:
# - GEMINI_API_KEY (Google GenAI for moderation)
# - FIREBASE_PROJECT_ID
# - FIREBASE_CLIENT_EMAIL
# - FIREBASE_PRIVATE_KEY
```

### 4. Start Development
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
npm start
```

## 📡 API Endpoints

### Identity Routes
- `POST /api/identity/register` - Register @USER.NAME
- `POST /api/identity/verify` - Verify hardware signature
- `GET /api/identity/:userName` - Get profile
- `PUT /api/identity/update` - Update metadata

### Wallet Routes
- `POST /api/wallet/transaction` - Cross-chain transaction
- `POST /api/wallet/tip` - Send tip
- `POST /api/wallet/subscribe` - Subscription payment
- `POST /api/wallet/purchase` - Marketplace purchase
- `GET /api/wallet/transactions/:userName` - Transaction history

### Content Routes
- `GET /api/content` - Get tenant content
- `POST /api/content` - Create content (with AI moderation)
- `POST /api/comments` - Post comment (with AI moderation)
- `POST /api/game-state` - Upload game state (Kreation)

## 🎨 Tenant Configuration

Each tenant has unique branding applied via CSS variables:

| Tenant | Primary Color | Chain | Purpose |
|--------|--------------|-------|---------|
| MVN | Rose (#F43F5E) | Ethereum | Music video network |
| StreamShare | Amber (#F59E0B) | Polygon | Social content |
| ArcHaven | Indigo (#6366F1) | Arbitrum | Creator sanctuary |
| HekticTV | Lime (#84CC16) | Optimism | Live broadcasting |
| Kreation | Cyan (#06B6D4) | Base | Gaming platform |

## 📦 Dependencies

### Core
- `express` - Web framework
- `firebase` & `firebase-admin` - Backend & auth
- `@google/genai` - AI moderation
- `react` & `react-dom` - Frontend
- `vite` - Build tool
- `tailwindcss` - Styling
- `motion` - Animations
- `lucide-react` - Icons
- `ethers` - Web3 transactions

### Dev
- `typescript` - Type safety
- `tsx` - TypeScript execution
- `@types/*` - Type definitions

## 🔧 TypeScript Commands

```bash
npm run lint      # Type check
npm run build     # Production build
npm run dev       # Development server
npm start         # Production server
```

## 📄 Key Files Explained

### server.ts (Main Backend)
- Multi-tenant bridge middleware
- Decentralized identity authentication
- AI content moderation
- Unified database service
- Vite integration for frontend

### src/routes/identity.ts
- @USER.NAME registration
- Hardware signature verification
- Firebase Custom Token minting
- Identity profile management

### src/routes/wallet.ts
- Cross-chain transaction routing
- Web3 scaffolding (ethers.js ready)
- Transaction history
- Tenant-specific chain configs

### src/context/TenantProvider.tsx
- React context for tenant state
- CSS variable injection
- Dynamic theming system
- Tenant switching component

### firestore.rules
- Tenant isolation enforcement
- User ownership verification
- Moderation requirements
- Cross-tenant data protection

## 🌐 Frontend Integration

### Using TenantProvider
```tsx
import { TenantProvider, useTenant, TenantSwitcher } from './context/TenantProvider';

function App() {
  return (
    <TenantProvider defaultTenant="MVN" persistTenant={true}>
      <MainContent />
    </TenantProvider>
  );
}

function MainContent() {
  const { currentTenant, setTenant, isTenant } = useTenant();
  
  return (
    <div>
      <h1>{currentTenant?.name}</h1>
      <TenantSwitcher />
    </div>
  );
}
```

### Using CSS Variables
```css
.element {
  background: var(--tenant-primary);
  color: var(--tenant-accent);
  border-radius: var(--radius-tenant);
  font-family: var(--font-tenant);
}
```

## 🔒 Security Notes

1. **Never commit `.env`** - Contains API keys and private keys
2. **Use HSM for production** - Store private keys in secure hardware
3. **Enable Firestore rules** - Deploy rules before production
4. **Monitor transactions** - Set up alerts for suspicious activity
5. **Rate limit endpoints** - Protect against abuse

## 📞 Support

For technical support:
- Documentation: See README.md
- Issues: Check inline comments
- Security: Review firestore.rules

---

**Innova Master Brain Engine v5.0.4**
*Decentralized Multi-Tenant Media Platform*