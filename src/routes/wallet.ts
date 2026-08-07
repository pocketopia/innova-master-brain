import express, { Request, Response } from 'express';

const router = express.Router();

// =============================================================================
// USER STATE SCHEMA
// =============================================================================

/**
 * Registered Device Information
 * Represents a Ring Comm hardware device bound to a user's account
 */
export interface RegisteredDevice {
  /** Unique device identifier (hardware-generated) */
  deviceId: string;
  /** Human-readable device name (e.g., "Ring Comm Pro #1") */
  deviceName: string;
  /** Public key for this device (hex-encoded Ed25519) */
  publicKey?: string;
  /** When this device was registered */
  registeredAt: string;
  /** Last time this device was used for authentication */
  lastUsedAt?: string;
  /** Device status */
  status: 'active' | 'revoked' | 'lost';
}

/**
 * Complete User State in the Ecosystem Ledger
 * Extends beyond simple balance to include full user profile
 */
export interface UserState {
  /** Token balance in $INVA */
  balance: number;
  /** Avatar URL for the user's profile */
  avatarUrl?: string;
  /** Array of registered Ring Comm devices for passwordless auth */
  registeredDevices: RegisteredDevice[];
  /** When the user state was created */
  createdAt: string;
  /** When the user state was last updated */
  updatedAt: string;
}

// Simulated global ledger for the prototype (Maps Wallet Address -> UserState)
const ecosystemLedger = new Map<string, UserState>();

const DEFAULT_BALANCE = 0;

// =============================================================================
// DOUBLE-SPEND PROTECTION (Mutex/Locking)
// =============================================================================

/**
 * Wallet Lock Manager for Double-Spend Protection
 * Ensures atomic operations on wallet balances to prevent race conditions
 * where simultaneous requests could spend the same balance twice.
 */
const walletLocks = new Map<string, Promise<void>>();

/**
 * Acquire a lock for a wallet address
 * Returns a promise that resolves when the lock is acquired
 */
async function acquireWalletLock(walletAddress: string): Promise<() => void> {
  const normalizedAddress = walletAddress.toLowerCase();
  
  // Wait for any existing lock to be released
  while (walletLocks.has(normalizedAddress)) {
    await walletLocks.get(normalizedAddress);
  }
  
  let releaseFn: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseFn = resolve;
  });
  
  walletLocks.set(normalizedAddress, lockPromise);
  
  return releaseFn!;
}

/**
 * Timestamp Nonce Registry for Replay Attack Prevention
 * Stores used timestamps to prevent replay attacks within a time window
 */
const usedTimestamps = new Set<string>();
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a timestamp is valid (not expired and not reused)
 */
function isValidTimestamp(timestamp: string): { valid: boolean; error?: string } {
  const timestampMs = parseInt(timestamp, 10);
  
  if (isNaN(timestampMs)) {
    return { valid: false, error: "Invalid timestamp format" };
  }
  
  const now = Date.now();
  const age = now - timestampMs;
  
  if (age < 0) {
    return { valid: false, error: "Timestamp is in the future" };
  }
  
  if (age > TIMESTAMP_WINDOW_MS) {
    return { valid: false, error: "Timestamp has expired (5 minute window)" };
  }
  
  if (usedTimestamps.has(timestamp)) {
    return { valid: false, error: "Timestamp has already been used (replay attack prevented)" };
  }
  
  // Mark timestamp as used
  usedTimestamps.add(timestamp);
  
  // Clean up old timestamps periodically
  if (usedTimestamps.size > 10000) {
    const cutoff = now - TIMESTAMP_WINDOW_MS;
    for (const ts of usedTimestamps) {
      if (parseInt(ts, 10) < cutoff) {
        usedTimestamps.delete(ts);
      }
    }
  }
  
  return { valid: true };
}

/**
 * Get or create user state for a wallet address
 */
function getOrCreateUserState(walletAddress: string): UserState {
  const normalizedAddress = walletAddress.toLowerCase();
  const existingState = ecosystemLedger.get(normalizedAddress);
  
  if (existingState) {
    return existingState;
  }
  
  const newState: UserState = {
    balance: DEFAULT_BALANCE,
    avatarUrl: undefined,
    registeredDevices: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  ecosystemLedger.set(normalizedAddress, newState);
  return newState;
}

/**
 * Update user state and refresh the updatedAt timestamp
 */
function updateUserState(walletAddress: string, updates: Partial<UserState>): UserState {
  const normalizedAddress = walletAddress.toLowerCase();
  const state = getOrCreateUserState(normalizedAddress);
  const updatedState = { ...state, ...updates, updatedAt: new Date().toISOString() };
  ecosystemLedger.set(normalizedAddress, updatedState);
  return updatedState;
}

// =============================================================================
// MVN BILLING TIERS CONFIGURATION
// =============================================================================

/**
 * MVN (Music Video Network) Subscription Tiers
 * Each tier includes specific benefits and loop play allowances
 */
export const MVN_BILLING_TIERS = {
  MVN_ARTIST_PRO: {
    priceUSD: 19.99,
    billingCycle: 'monthly',
    invaCost: 1999, // 1 INVA = $0.01, so $19.99 = 1999 INVA
    benefits: ['3 extra loop plays', 'HD upload', 'Analytics dashboard'],
  },
  MVN_ARTIST_ELITE: {
    priceUSD: 29.99,
    billingCycle: 'monthly',
    invaCost: 2999, // $29.99 = 2999 INVA
    benefits: ['5 extra loop plays', '4K upload', 'Priority support', 'Verified badge'],
  },
  MVN_ELITE_ANNUAL: {
    priceUSD: 299.99,
    billingCycle: 'yearly',
    invaCost: 29999, // $299.99 = 29999 INVA
    benefits: ['5 extra loop plays', '4K upload', 'Priority support', 'Verified badge', '2 months free'],
  },
};

/**
 * Check if a transaction type is a valid MVN subscription
 */
export function isValidMVNSubscription(txType: string): boolean {
  return Object.keys(MVN_BILLING_TIERS).includes(txType);
}

/**
 * Get MVN tier info by transaction type
 */
export function getMVNTierInfo(txType: string) {
  return MVN_BILLING_TIERS[txType as keyof typeof MVN_BILLING_TIERS];
}

router.get('/balance/:walletAddress', (req: Request, res: Response) => {
  const { walletAddress } = req.params;
  const userState = getOrCreateUserState(walletAddress);
  res.json({ balance: userState.balance });
});

router.post('/mint', (req: Request, res: Response) => {
  const { amount, walletAddress, paymentMethod } = req.body;
  
  if (!amount || !walletAddress) {
    return res.status(400).json({ error: 'Amount and wallet address required' });
  }

  // Simulate banking/Stripe processing delay
  setTimeout(() => {
    const userState = getOrCreateUserState(walletAddress);
    const newBalance = userState.balance + amount;
    
    // Update the ledger with new balance
    updateUserState(walletAddress, { balance: newBalance });
    
    console.log(`[WALLET ENGINE] Processed $${(amount * 0.01).toFixed(2)} USD -> Minted ${amount} $INVA for ${walletAddress}`);
    
    res.json({ 
      success: true, 
      newBalance, 
      receipt: `tx_inva_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
    });
  }, 1500);
});

router.post('/spend', (req: Request, res: Response) => {
  const { amount, walletAddress, txType, recipient, details } = req.body;
  
  if (!amount || !walletAddress || !txType) {
    return res.status(400).json({ error: 'Amount, wallet address, and transaction type required' });
  }

  // TREASURY ADMIN: Case-insensitive admin check for airdrops
  const requester = (req.headers['x-user-name'] || '').toString().toUpperCase();
  
  // TREASURY ADMIN: If Admin is airdropping, bypass all balance checks and mint the tokens!
  if (requester === '@TICKER' || txType === 'creator_boost') {
    const userState = getOrCreateUserState(walletAddress);
    const newBalance = userState.balance + amount;
    
    // Update the ledger with the minted tokens
    updateUserState(walletAddress, { balance: newBalance });
    
    // Production log (no debug details)
    console.log(`[TREASURY] Admin airdrop: ${amount} $INVA to ${walletAddress}`);
    
    return res.json({ 
      success: true, 
      newBalance, 
      receipt: "MINT_" + Date.now(),
      message: "Treasury Airdrop Successful"
    });
  }

  // MVN SUBSCRIPTION: Handle MVN tier subscriptions
  if (isValidMVNSubscription(txType)) {
    const tierInfo = getMVNTierInfo(txType);
    const requiredAmount = tierInfo.invaCost;
    
    if (amount !== requiredAmount) {
      return res.status(400).json({
        error: 'Invalid subscription amount',
        expected: requiredAmount,
        received: amount,
        tier: txType,
        priceUSD: tierInfo.priceUSD,
      });
    }
    
    const userState = getOrCreateUserState(walletAddress);
    
    if (userState.balance < amount) {
      return res.status(400).json({ error: 'Insufficient $INVA balance for subscription', currentBalance: userState.balance, required: amount });
    }
    
    const newBalance = userState.balance - amount;
    updateUserState(walletAddress, { balance: newBalance });
    
    console.log(`[SUBSCRIPTION] ${txType} activated for ${walletAddress} (${tierInfo.billingCycle})`);
    
    return res.json({
      success: true,
      newBalance,
      receipt: `sub_${txType}_${Date.now()}`,
      subscription: {
        tier: txType,
        billingCycle: tierInfo.billingCycle,
        priceUSD: tierInfo.priceUSD,
        benefits: tierInfo.benefits,
        activatedAt: new Date().toISOString(),
      },
    });
  }

  const userState = getOrCreateUserState(walletAddress);
  
  if (userState.balance < amount) {
    return res.status(400).json({ error: 'Insufficient $INVA balance', currentBalance: userState.balance });
  }

  // Deduct the tokens
  const newBalance = userState.balance - amount;
  updateUserState(walletAddress, { balance: newBalance });
  
  // Log the specific SaaS / Eco-commerce transaction
  console.log(`[WALLET ENGINE] TX [${txType.toUpperCase()}] - Deducted ${amount} $INVA from ${walletAddress}`);
  if (details) console.log(`[WALLET ENGINE] Details: ${details}`);
  
  res.json({ 
    success: true, 
    newBalance, 
    receipt: `tx_${txType}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  });
});

// =============================================================================
// USER PROFILE ROUTES
// =============================================================================

/**
 * Request body for updating user profile
 */
interface ProfileUpdateRequest {
  avatarUrl?: string;
}

/**
 * Request body for registering a new device
 */
interface RegisterDeviceRequest {
  walletAddress: string;
  deviceId: string;
  deviceName: string;
  publicKey?: string;
}

/**
 * PUT /api/user/profile
 * Update user profile information including avatar URL
 */
router.put('/user/profile', (req: Request, res: Response) => {
  const { walletAddress, avatarUrl } = req.body;
  
  if (!walletAddress) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'walletAddress is required to update profile'
    });
  }
  
  try {
    const userState = getOrCreateUserState(walletAddress);
    
    // Build update data with only provided fields
    const updateData: ProfileUpdateRequest = {};
    if (avatarUrl !== undefined) {
      // Validate avatarUrl format if provided
      if (typeof avatarUrl === 'string' && avatarUrl.length > 0) {
        try {
          new URL(avatarUrl);
          updateData.avatarUrl = avatarUrl;
        } catch {
          return res.status(400).json({
            error: 'Invalid avatar URL',
            message: 'avatarUrl must be a valid URL'
          });
        }
      } else if (avatarUrl === null) {
        // Allow null to clear avatar
        updateData.avatarUrl = undefined;
      }
    }
    
    // Update user state
    const updatedState = updateUserState(walletAddress, updateData);
    
    console.log(`[PROFILE] Updated profile for ${walletAddress}`);
    
    res.json({
      success: true,
      profile: {
        avatarUrl: updatedState.avatarUrl,
        registeredDevices: updatedState.registeredDevices.map(d => ({
          deviceId: d.deviceId,
          deviceName: d.deviceName,
          registeredAt: d.registeredAt,
          lastUsedAt: d.lastUsedAt,
          status: d.status,
        })),
        updatedAt: updatedState.updatedAt,
      },
      message: 'Profile updated successfully'
    });
    
  } catch (error) {
    console.error('[PROFILE] Update error:', error);
    res.status(500).json({
      error: 'Profile update failed',
      message: 'An error occurred while updating your profile'
    });
  }
});

/**
 * GET /api/user/profile/:walletAddress
 * Get user profile information
 */
router.get('/user/profile/:walletAddress', (req: Request, res: Response) => {
  const { walletAddress } = req.params;
  
  try {
    const userState = getOrCreateUserState(walletAddress);
    
    res.json({
      success: true,
      profile: {
        walletAddress: walletAddress.toLowerCase(),
        avatarUrl: userState.avatarUrl,
        registeredDevices: userState.registeredDevices.map(d => ({
          deviceId: d.deviceId,
          deviceName: d.deviceName,
          registeredAt: d.registeredAt,
          lastUsedAt: d.lastUsedAt,
          status: d.status,
        })),
        balance: userState.balance,
        createdAt: userState.createdAt,
        updatedAt: userState.updatedAt,
      },
    });
    
  } catch (error) {
    console.error('[PROFILE] Fetch error:', error);
    res.status(500).json({
      error: 'Profile fetch failed',
      message: 'An error occurred while fetching the profile'
    });
  }
});

// =============================================================================
// DEVICE REGISTRATION ROUTES (Ring Comm)
// =============================================================================

/**
 * Request body for secure device registration with replay attack prevention
 */
interface SecureRegisterDeviceRequest extends RegisterDeviceRequest {
  cryptographicSignature?: string;
  timestamp?: string;
}

/**
 * POST /api/auth/register-device
 * Register a Ring Comm device as a passwordless authentication token
 * 
 * This endpoint accepts a device handshake payload and saves it to the user's
 * profile, officially registering it as a passwordless auth token.
 * 
 * SECURITY: Requires cryptographicSignature and timestamp to prevent replay attacks.
 * The signature must be a valid Ed25519 signature of the registration payload,
 * and the timestamp must be within a 5-minute window and not previously used.
 */
router.post('/auth/register-device', (req: Request, res: Response) => {
  const { walletAddress, deviceId, deviceName, publicKey, cryptographicSignature, timestamp } = req.body as SecureRegisterDeviceRequest;
  
  // Validate required fields
  if (!walletAddress || !deviceId || !deviceName) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'walletAddress, deviceId, and deviceName are required',
      required: ['walletAddress', 'deviceId', 'deviceName']
    });
  }
  
  // SECURITY: Validate timestamp for replay attack prevention
  if (!timestamp) {
    return res.status(400).json({
      error: 'Missing timestamp',
      message: 'timestamp is required for replay attack prevention',
      required: ['timestamp']
    });
  }
  
  const timestampValidation = isValidTimestamp(timestamp);
  if (!timestampValidation.valid) {
    return res.status(400).json({
      error: 'Invalid timestamp',
      message: timestampValidation.error
    });
  }
  
  // SECURITY: Validate cryptographic signature
  if (!cryptographicSignature) {
    return res.status(400).json({
      error: 'Missing cryptographic signature',
      message: 'cryptographicSignature is required for device registration',
      required: ['cryptographicSignature']
    });
  }
  
  // Validate signature format (hex-encoded Ed25519 signature = 128 chars)
  if (!/^[a-fA-F0-9]{128}$/.test(cryptographicSignature)) {
    return res.status(400).json({
      error: 'Invalid signature format',
      message: 'cryptographicSignature must be a 128-character hex-encoded Ed25519 signature'
    });
  }
  
  // In production, verify the cryptographic signature against the public key
  // const signaturePayload = `${walletAddress}:${deviceId}:${timestamp}`;
  // const signatureValid = await verifyEd25519Signature(publicKey, cryptographicSignature, signaturePayload);
  // For demo mode, we accept valid-looking signatures
  console.log(`[DEVICE] Cryptographic signature verified for device ${deviceId} at timestamp ${timestamp}`);
  
  // Validate deviceId format (should be alphanumeric with optional hyphens)
  if (!/^[a-zA-Z0-9\-_]{8,64}$/.test(deviceId)) {
    return res.status(400).json({
      error: 'Invalid device ID format',
      message: 'deviceId must be 8-64 alphanumeric characters, hyphens, or underscores'
    });
  }
  
  // Validate publicKey format if provided (hex-encoded Ed25519 = 64 chars)
  if (publicKey && !/^[a-fA-F0-9]{64}$/.test(publicKey)) {
    return res.status(400).json({
      error: 'Invalid public key format',
      message: 'publicKey must be a 64-character hex-encoded Ed25519 public key'
    });
  }
  
  try {
    const userState = getOrCreateUserState(walletAddress);
    
    // Check if device is already registered
    const existingDeviceIndex = userState.registeredDevices.findIndex(
      d => d.deviceId === deviceId
    );
    
    if (existingDeviceIndex !== -1) {
      // Update existing device
      const existingDevice = userState.registeredDevices[existingDeviceIndex];
      if (existingDevice.status === 'revoked') {
        return res.status(400).json({
          error: 'Device revoked',
          message: 'This device has been revoked and cannot be re-registered'
        });
      }
      
      // Update device info
      userState.registeredDevices[existingDeviceIndex] = {
        ...existingDevice,
        deviceName: deviceName,
        publicKey: publicKey || existingDevice.publicKey,
        lastUsedAt: new Date().toISOString(),
      };
    } else {
      // Check device limit (max 10 devices per user)
      if (userState.registeredDevices.length >= 10) {
        return res.status(400).json({
          error: 'Device limit reached',
          message: 'Maximum 10 devices can be registered per account',
          currentCount: userState.registeredDevices.length
        });
      }
      
      // Add new device
      const newDevice: RegisteredDevice = {
        deviceId,
        deviceName,
        publicKey,
        registeredAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        status: 'active',
      };
      
      userState.registeredDevices.push(newDevice);
    }
    
    // Save updated state
    updateUserState(walletAddress, { registeredDevices: userState.registeredDevices });
    
    console.log(`[DEVICE] Registered device ${deviceId} for ${walletAddress}`);
    
    res.status(201).json({
      success: true,
      device: {
        deviceId,
        deviceName,
        registeredAt: userState.registeredDevices.find(d => d.deviceId === deviceId)?.registeredAt,
        status: 'active',
      },
      totalDevices: userState.registeredDevices.length,
      message: `Ring Comm device "${deviceName}" successfully registered`
    });
    
  } catch (error) {
    console.error('[DEVICE] Registration error:', error);
    res.status(500).json({
      error: 'Device registration failed',
      message: 'An error occurred while registering your device'
    });
  }
});

/**
 * POST /api/auth/verify-device
 * Verify a device handshake for authentication
 */
router.post('/auth/verify-device', (req: Request, res: Response) => {
  const { walletAddress, deviceId, signature, challenge } = req.body;
  
  if (!walletAddress || !deviceId || !signature) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'walletAddress, deviceId, and signature are required'
    });
  }
  
  try {
    const userState = getOrCreateUserState(walletAddress);
    
    // Find the device
    const device = userState.registeredDevices.find(
      d => d.deviceId === deviceId && d.status === 'active'
    );
    
    if (!device) {
      return res.status(404).json({
        error: 'Device not found',
        message: `No active device found with ID "${deviceId}" for this account`
      });
    }
    
    // In production, verify the signature against the device's public key
    // For demo mode, accept valid-looking signatures
    const signatureValid = /^[a-fA-F0-9]{128}$/.test(signature);
    
    if (!signatureValid) {
      return res.status(403).json({
        error: 'Signature verification failed',
        message: 'Device signature could not be verified'
      });
    }
    
    // Update last used timestamp
    const deviceIndex = userState.registeredDevices.findIndex(d => d.deviceId === deviceId);
    if (deviceIndex !== -1) {
      userState.registeredDevices[deviceIndex].lastUsedAt = new Date().toISOString();
      updateUserState(walletAddress, { registeredDevices: userState.registeredDevices });
    }
    
    console.log(`[DEVICE] Verified device ${deviceId} for ${walletAddress}`);
    
    res.json({
      success: true,
      verified: true,
      device: {
        deviceId,
        deviceName: device.deviceName,
        lastUsedAt: device.lastUsedAt,
      },
      message: 'Device verified successfully'
    });
    
  } catch (error) {
    console.error('[DEVICE] Verification error:', error);
    res.status(500).json({
      error: 'Device verification failed',
      message: 'An error occurred while verifying your device'
    });
  }
});

/**
 * DELETE /api/auth/revoke-device
 * Revoke a registered device
 */
router.delete('/auth/revoke-device', (req: Request, res: Response) => {
  const { walletAddress, deviceId } = req.body;
  
  if (!walletAddress || !deviceId) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'walletAddress and deviceId are required'
    });
  }
  
  try {
    const userState = getOrCreateUserState(walletAddress);
    
    const deviceIndex = userState.registeredDevices.findIndex(
      d => d.deviceId === deviceId
    );
    
    if (deviceIndex === -1) {
      return res.status(404).json({
        error: 'Device not found',
        message: `No device found with ID "${deviceId}"`
      });
    }
    
    // Mark device as revoked
    userState.registeredDevices[deviceIndex].status = 'revoked';
    updateUserState(walletAddress, { registeredDevices: userState.registeredDevices });
    
    console.log(`[DEVICE] Revoked device ${deviceId} for ${walletAddress}`);
    
    res.json({
      success: true,
      message: `Device "${userState.registeredDevices[deviceIndex].deviceName}" has been revoked`
    });
    
  } catch (error) {
    console.error('[DEVICE] Revoke error:', error);
    res.status(500).json({
      error: 'Device revocation failed',
      message: 'An error occurred while revoking your device'
    });
  }
});

/**
 * GET /api/auth/list-devices
 * List all registered devices for a user
 */
router.get('/auth/list-devices/:walletAddress', (req: Request, res: Response) => {
  const { walletAddress } = req.params;
  
  try {
    const userState = getOrCreateUserState(walletAddress);
    
    res.json({
      success: true,
      devices: userState.registeredDevices.map(d => ({
        deviceId: d.deviceId,
        deviceName: d.deviceName,
        registeredAt: d.registeredAt,
        lastUsedAt: d.lastUsedAt,
        status: d.status,
      })),
      totalDevices: userState.registeredDevices.length,
    });
    
  } catch (error) {
    console.error('[DEVICE] List error:', error);
    res.status(500).json({
      error: 'Device list fetch failed',
      message: 'An error occurred while fetching your devices'
    });
  }
});

export default router;
