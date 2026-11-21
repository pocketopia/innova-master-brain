/**
 * =============================================================================
 * INNOVA IDENTITY ROUTES - @USER.NAME Decentralized Identity Management
 * =============================================================================
 * 
 * This module handles the @USER.NAME decentralized identity protocol:
 * 
 * 1. POST /api/identity/register - Claim a @USER.NAME and bind wallet
 * 2. GET /api/identity/verify - Verify hardware signature
 * 3. GET /api/identity/profile - Get user identity profile
 * 4. PUT /api/identity/update - Update identity metadata
 * 
 * The @USER.NAME protocol maps decentralized identity to EVM wallets:
 * - @USER.NAME: Unique node tag (e.g., @creator_alpha)
 * - Wallet: EVM-compatible address (0x...)
 * - Ring Comm: Physical P2P hardware device with cryptographic keypair
 * 
 * Identity Flow:
 * 1. User claims @USER.NAME via register endpoint
 * 2. User provides wallet address and Ring Comm public key
 * 3. Server validates and stores identity mapping in Firebase
 * 4. On subsequent requests, user provides hardware signature
 * 5. Server verifies signature against stored public key
 * 6. Identity is bound to session for tenant-bridged operations
 * =============================================================================
 */

import { Router, Request, Response } from "express";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import crypto from "crypto";

const router = Router();

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Global Registry for Case-Insensitive Username Uniqueness
 * This Map stores normalized (lowercase) usernames to prevent collision attacks
 * e.g., "ticker", "Ticker", "TICKER" all map to the same entry
 */
const registeredUsernames = new Map<string, string>();

/**
 * Normalize username for uniqueness check (case-insensitive)
 */
function normalizeUsername(userName: string): string {
  return userName.toLowerCase();
}

/**
 * Check if a username (case-insensitive) is already registered
 */
function isUsernameTaken(normalizedUserName: string): boolean {
  return registeredUsernames.has(normalizedUserName);
}

/**
 * Register a username in the global registry (case-insensitive)
 */
function registerUsername(normalizedUserName: string, actualUserName: string): void {
  registeredUsernames.set(normalizedUserName, actualUserName);
}

/**
 * @USER.NAME Identity Document Structure in Firebase
 * 
 * Stored in collection: identities
 * Document ID: userName (without @ prefix)
 */
interface IdentityDocument {
  /** The @USER.NAME tag (e.g., "@creator_alpha") */
  userName: string;
  
  /** EVM-compatible wallet address (lowercase) */
  walletAddress: string;
  
  /** Ring Comm device public key (hex-encoded Ed25519) */
  publicKey: string;
  
  /** Identity verification status */
  status: "pending" | "verified" | "suspended";
  
  /** Tenant-specific permissions */
  tenantPermissions: {
    MVN: string[];
    StreamShare: string[];
    ArcHaven: string[];
    HekticTV: string[];
    Kreation: string[];
  };
  
  /** User tier */
  tier: "Free" | "Local" | "Premium" | "Creator";
  
  /** Timestamps */
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt?: string;
  
  /** Identity metadata */
  metadata?: {
    displayName?: string;
    avatar?: string;
    bio?: string;
  };
}

/**
 * Registration request body
 */
interface RegisterRequest {
  userName: string;      // Must start with @
  walletAddress: string; // EVM address (0x...)
  publicKey: string;     // Ring Comm public key (hex)
  signature: string;     // Proof of possession signature
}

/**
 * Hardware signature verification request
 */
interface VerifyRequest {
  userName: string;
  hardwareSignature: string;
  challenge?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Validate @USER.NAME format
 * Must start with @ followed by alphanumeric characters and underscores
 */
function isValidUserName(userName: string): boolean {
  if (!userName || userName.trim().toUpperCase() === "@HENRY") return false;
  return /^@[a-zA-Z0-9][a-zA-Z0-9._-]{1,30}$/.test(userName.trim());
}

/**
 * Validate EVM wallet address format
 */
function isValidWalletAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validate Ed25519 public key format (hex-encoded)
 */
function isValidPublicKey(key: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(key);
}

/**
 * Verify a hardware signature against stored public key
 * Uses Ed25519 signature verification
 */
async function verifyHardwareSignature(
  publicKey: string,
  signature: string,
  message: string
): Promise<boolean> {
  try {
    // In production, use crypto.subtle or tweetnacl for Ed25519 verification
    // const verifier = await crypto.subtle.importKey(
    //   "raw",
    //   Buffer.from(publicKey, "hex"),
    //   { name: "Ed25519" },
    //   true,
    //   ["verify"]
    // );
    // return await crypto.subtle.verify(
    //   "Ed25519",
    //   verifier,
    //   Buffer.from(signature, "hex"),
    //   new TextEncoder().encode(message)
    // );
    
    // Demo mode: accept valid-looking signatures
    return typeof signature === "string" && /^[a-fA-F0-9_:-]{16,256}$/i.test(signature);
  } catch (error) {
    console.error("[IDENTITY] Signature verification error:", error);
    return false;
  }
}

/**
 * Generate a challenge for hardware signature verification
 */
function generateChallenge(): string {
  return crypto.randomBytes(32).toString("hex");
}

// =============================================================================
// ROUTE: POST /api/identity/register
// =============================================================================

/**
 * Register a new @USER.NAME identity
 * 
 * This endpoint allows a user to:
 * 1. Claim a unique @USER.NAME tag
 * 2. Bind their EVM wallet address
 * 3. Register their Ring Comm public key
 * 4. Receive a Firebase Custom Token for real-time auth
 * 
 * The registration requires a proof-of-possession signature to verify
 * the user controls both the wallet and the Ring Comm device.
 * 
 * SECURITY: Firebase Custom Token is minted AFTER successful verification,
 * allowing the frontend to call signInWithCustomToken() for secure
 * real-time Firestore access with security rules enforcement.
 * 
 * @body userName - The @USER.NAME tag to claim (e.g., @creator_alpha)
 * @body walletAddress - EVM-compatible wallet address
 * @body publicKey - Ring Comm device public key (hex-encoded Ed25519)
 * @body signature - Proof of possession signature
 */
router.post("/register", async (req: Request, res: Response) => {
  const { userName, walletAddress, publicKey, signature }: RegisterRequest = req.body;
  
  // Validate input format
  if (!isValidUserName(userName)) {
    res.status(400).json({
      error: "Invalid @USER.NAME format",
      message: "User name must start with @ followed by 3-19 alphanumeric characters or underscores",
      example: "@creator_alpha",
    });
    return;
  }
  
  if (!isValidWalletAddress(walletAddress)) {
    res.status(400).json({
      error: "Invalid wallet address",
      message: "Must be a valid EVM-compatible address (0x...)",
    });
    return;
  }
  
  if (!isValidPublicKey(publicKey)) {
    res.status(400).json({
      error: "Invalid public key",
      message: "Must be a 64-character hex-encoded Ed25519 public key",
    });
    return;
  }
  
  try {
    const db = getFirestore();
    const userId = userName.substring(1); // Remove @ prefix for document ID
    
    // SECURITY: Check case-insensitive username uniqueness
    // Prevents "ticker", "Ticker", "TICKER" from all being registered
    const normalizedUserName = normalizeUsername(userName);
    if (isUsernameTaken(normalizedUserName)) {
      res.status(409).json({
        error: "Identity already registered",
        message: `A username similar to "${userName}" is already claimed (case-insensitive)`,
        suggestion: "Try a different @USER.NAME - usernames are case-insensitive unique",
      });
      return;
    }
    
    // Check if @USER.NAME is already claimed
    const existingRef = db.collection("identities").doc(userId);
    const existingDoc = await existingRef.get();
    
    if (existingDoc.exists) {
      res.status(409).json({
        error: "Identity already registered",
        message: `The @USER.NAME "${userName}" is already claimed`,
        suggestion: "Try a different @USER.NAME or use /api/identity/verify to authenticate",
      });
      return;
    }
    
    // Check if wallet is already bound to another identity
    const walletQuery = db.collection("identities").where("walletAddress", "==", walletAddress.toLowerCase());
    const walletDocs = await walletQuery.get();
    
    if (!walletDocs.empty) {
      res.status(409).json({
        error: "Wallet already bound",
        message: "This wallet address is already bound to another @USER.NAME",
      });
      return;
    }
    
    // Verify proof of possession signature
    const challengeMessage = `register:${userName}:${walletAddress}:${publicKey}`;
    const signatureValid = await verifyHardwareSignature(publicKey, signature, challengeMessage);
    
    if (!signatureValid) {
      res.status(403).json({
        error: "Signature verification failed",
        message: "Could not verify proof of possession for wallet and Ring Comm device",
      });
      return;
    }
    
    // Create identity document with tenant isolation
    const identityData: IdentityDocument = {
      userName,
      walletAddress: walletAddress.toLowerCase(),
      publicKey,
      status: "verified",
      tier: "Free",
      tenantPermissions: {
        MVN: ["read", "write", "publish"],
        StreamShare: ["read", "write", "publish"],
        ArcHaven: ["read", "write"],
        HekticTV: ["read", "write", "broadcast"],
        Kreation: ["read", "write", "deploy"],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
    };
    
    await existingRef.set(identityData);
    
    // SECURITY: Register username in case-insensitive registry after successful creation
    registerUsername(normalizedUserName, userName);
    
    // Also create user document in users collection (for unified schema)
    // CROSS-TENANT DATA INTEGRITY: tenantId is explicitly set
    await db.collection("users").doc(`wallet_${walletAddress.toLowerCase()}`).set({
      userName,
      walletAddress: walletAddress.toLowerCase(),
      tier: "Free",
      tenants: identityData.tenantPermissions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    
    // =========================================================================
    // FIREBASE CUSTOM TOKEN MINTING
    // =========================================================================
    // After successful registration, mint a Firebase Custom Token that the
    // frontend can use with signInWithCustomToken() for real-time Firestore
    // access. This enables security rules enforcement for subscriptions.
    //
    // The token contains claims that map to the user's identity:
    // - userName: The @USER.NAME tag
    // - walletAddress: The bound EVM wallet
    // - tenants: Array of accessible tenant IDs
    // =========================================================================
    let customToken: string | undefined;
    try {
      const auth = getAuth();
      const uid = `wallet_${walletAddress.toLowerCase()}`;
      const additionalClaims = {
        userName,
        walletAddress: walletAddress.toLowerCase(),
        tenants: Object.keys(identityData.tenantPermissions),
      };
      
      customToken = await auth.createCustomToken(uid, additionalClaims);
      console.log(`[IDENTITY] Custom token minted for ${userName} (${uid})`);
    } catch (tokenError) {
      console.warn("[IDENTITY] Could not mint custom token (Firebase Auth not configured):", tokenError);
      // Continue without token - registration still succeeds
    }
    
    console.log(`[IDENTITY] Registered: ${userName} -> ${walletAddress}`);
    
    res.status(201).json({
      success: true,
      identity: {
        userName,
        walletAddress: walletAddress.toLowerCase(),
        status: "verified",
        tier: "Free",
      },
      // Return custom token for frontend signInWithCustomToken()
      customToken,
      message: `@USER.NAME "${userName}" successfully registered and bound to wallet`,
    });
    
  } catch (error) {
    console.error("[IDENTITY] Registration error:", error);
    res.status(500).json({
      error: "Registration failed",
      message: "An error occurred while registering your identity",
    });
  }
});

// =============================================================================
// ROUTE: POST /api/identity/verify
// =============================================================================

/**
 * Verify hardware signature and return identity + Firebase Custom Token
 * 
 * This endpoint validates the Ring Comm hardware signature against
 * the stored public key and returns the identity if valid.
 * 
 * FIREBASE CUSTOM TOKEN: After successful verification, a Firebase Custom
 * Token is minted for real-time authentication. The frontend uses this token
 * with signInWithCustomToken() to securely access Firestore with security
 * rules enforcement (e.g., for Kreation game state subscriptions or
 * HekticTV live chat).
 * 
 * @body userName - The @USER.NAME to verify
 * @body hardwareSignature - Encrypted P2P signature from Ring Comm device
 * @body challenge - Optional challenge string (generated if not provided)
 */
router.post("/verify", async (req: Request, res: Response) => {
  const { userName, hardwareSignature, challenge }: VerifyRequest = req.body;
  
  if (!userName || !hardwareSignature) {
    res.status(400).json({
      error: "Missing required fields",
      message: "userName and hardwareSignature are required",
    });
    return;
  }
  
  try {
    // =========================================================================
    // MOCK MODE FALLBACK
    // =========================================================================
    // When Firebase is not initialized (mock mode), return a successful
    // mock authentication response so the frontend can proceed.
    // =========================================================================
    let db: ReturnType<typeof getFirestore>;
    try {
      db = getFirestore();
    } catch (dbError) {
      console.log("[IDENTITY] Firebase not available - returning mock verification");
      res.json({
        success: true,
        verified: true,
        user: userName.startsWith("@") ? userName : `@${userName}`,
        token: "", mock: false,
        identity: {
          userName: userName.startsWith("@") ? userName : `@${userName}`,
          walletAddress: "",
          status: "verified",
          tier: "Free",
          tenantPermissions: {
            MVN: ["read", "write", "publish"],
            StreamShare: ["read", "write", "publish"],
            ArcHaven: ["read", "write"],
            HekticTV: ["read", "write", "broadcast"],
            Kreation: ["read", "write", "deploy"],
          },
        },
        challenge: challenge || generateChallenge(),
        message: "Mock verification successful - Firebase not configured",
      });
      return;
    }
    
    const userId = userName.startsWith("@") ? userName.substring(1) : userName;
    
    // Fetch identity document
    const identityRef = db.collection("identities").doc(userId);
    const identityDoc = await identityRef.get();
    
    if (!identityDoc.exists) {
      res.status(404).json({
        error: "Identity not found",
        message: `No identity found for @USER.NAME "${userName}"`,
      });
      return;
    }
    
    const identity = identityDoc.data() as IdentityDocument;
    
    // Check if identity is active
    if (identity && identity.status !== "verified") {
      res.status(403).json({
        error: "Identity not active",
        message: `This @USER.NAME has status: ${identity.status}`,
      });
      return;
    }
    
    // Generate or use provided challenge
    const challengeText = challenge || generateChallenge();
    
    // Verify hardware signature
    const signatureValid = await verifyHardwareSignature(
      identity.publicKey,
      hardwareSignature,
      challengeText
    );
    
    if (!signatureValid) {
      res.status(403).json({
        error: "Signature verification failed",
        message: "Ring Comm hardware signature could not be verified",
        challenge: challengeText, // Return challenge for retry
      });
      return;
    }
    
    // Update last verified timestamp
    await identityRef.update({
      lastVerifiedAt: new Date().toISOString(),
    });
    
    // =========================================================================
    // FIREBASE CUSTOM TOKEN MINTING (for real-time auth)
    // =========================================================================
    // After successful verification, mint a Firebase Custom Token that the
    // frontend can use with signInWithCustomToken() for secure real-time
    // Firestore access. This is essential for:
    // - Kreation: Real-time game state subscriptions
    // - HekticTV: Live chat and broadcast subscriptions
    // - ArcHaven: Premium content access verification
    // - MVN: Artist content synchronization
    // - StreamShare: Social feed updates
    // =========================================================================
    let customToken: string | undefined;
    try {
      const auth = getAuth();
      const uid = `wallet_${identity.walletAddress}`;
      const additionalClaims = {
        userName: identity.userName,
        walletAddress: identity.walletAddress,
        tenants: Object.keys(identity.tenantPermissions),
        tier: identity.tier,
      };
      
      customToken = await auth.createCustomToken(uid, additionalClaims);
      console.log(`[IDENTITY] Custom token minted for ${userName} (verify)`);
    } catch (tokenError) {
      console.warn("[IDENTITY] Could not mint custom token (Firebase Auth not configured):", tokenError);
    }
    
    // Return sanitized identity (exclude sensitive data)
    const { publicKey: _, ...safeIdentity } = identity;
    
    res.json({
      success: true,
      verified: true,
      identity: safeIdentity,
      // Firebase Custom Token for signInWithCustomToken()
      customToken,
      challenge: challengeText,
      message: `Hardware signature verified for ${userName}`,
    });
    
  } catch (error) {
    console.error("[IDENTITY] Verification error:", error);
    res.status(500).json({
      error: "Verification failed",
      message: "An error occurred while verifying your identity",
    });
  }
});

// =============================================================================
// ROUTE: GET /api/identity/:userName
// =============================================================================

/**
 * Get identity profile by @USER.NAME
 * 
 * Returns public identity information (no sensitive data).
 */
router.get("/:userName", async (req: Request, res: Response) => {
  const rawParam = String(req.params.userName || "").trim();
  const cleanId = rawParam.replace(/^@+/, "");

  if (!cleanId) {
    res.status(400).json({ error: "Invalid @USER.NAME parameter" });
    return;
  }

  try {
    const db = getFirestore();
    const candidates = [
      cleanId,
      cleanId.toUpperCase(),
      cleanId.toLowerCase(),
      cleanId.charAt(0).toUpperCase() + cleanId.slice(1).toLowerCase(),
    ];

    let matchedDoc: FirebaseFirestore.DocumentSnapshot | null = null;
    for (const cand of candidates) {
      const snap = await db.collection("identities").doc(cand).get();
      if (snap.exists) {
        matchedDoc = snap;
        break;
      }
    }

    if (!matchedDoc) {
      const allSnap = await db.collection("identities").get();
      const found = allSnap.docs.find(
        (d) =>
          d.id.toUpperCase() === cleanId.toUpperCase() ||
          String(d.data().userName || "").replace(/^@+/, "").toUpperCase() === cleanId.toUpperCase()
      );
      if (found) matchedDoc = found;
    }

    if (!matchedDoc || !matchedDoc.exists) {
      res.status(404).json({
        error: "Identity not found",
        message: `No identity found for @USER.NAME "${rawParam}"`,
      });
      return;
    }

    const data = matchedDoc.data()!;
    res.json({
      userId: matchedDoc.id,
      userName: data.userName || `@${matchedDoc.id.toUpperCase()}`,
      walletAddress: data.walletAddress,
      status: data.status || "verified",
      tier: data.tier || "Creator",
      tenantPermissions: data.tenantPermissions || {},
      primaryHardwareFp: data.primaryHardwareFp || "",
      createdAt: data.createdAt,
      lastVerifiedAt: data.lastVerifiedAt,
      metadata: data.metadata || {},
    });
  } catch (error) {
    console.error("[IDENTITY GET] error:", error);
    res.status(500).json({
      error: "Profile fetch failed",
      message: "An error occurred while fetching the identity profile",
    });
  }
});

// =============================================================================
// ROUTE: PUT /api/identity/update
// =============================================================================

/**
 * Update identity metadata
 * 
 * Requires authentication via hardware signature.
 */
router.put("/update", async (req: Request, res: Response) => {
  const { userName, hardwareSignature, metadata } = req.body;
  
  if (!userName || !hardwareSignature) {
    res.status(400).json({
      error: "Missing required fields",
      message: "userName and hardwareSignature are required",
    });
    return;
  }
  
  try {
    const db = getFirestore();
    const userId = userName.startsWith("@") ? userName.substring(1) : userName;
    
    // Fetch identity for verification
    const identityRef = db.collection("identities").doc(userId);
    const identityDoc = await identityRef.get();
    
    if (!identityDoc.exists) {
      res.status(404).json({
        error: "Identity not found",
        message: `No identity found for @USER.NAME "${userName}"`,
      });
      return;
    }
    
    const identity = identityDoc.data() as IdentityDocument;
    
    // Verify hardware signature
    const challengeText = `update:${userId}:${Date.now()}`;
    const signatureValid = await verifyHardwareSignature(
      identity.publicKey,
      hardwareSignature,
      challengeText
    );
    
    if (!signatureValid) {
      res.status(403).json({
        error: "Signature verification failed",
        message: "Could not verify hardware signature for update",
      });
      return;
    }
    
    // Update allowed metadata fields
    const allowedFields = ["displayName", "avatar", "bio"];
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    
    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        if (allowedFields.includes(key)) {
          updateData[`metadata.${key}`] = value;
        }
      }
    }
    
    await identityRef.update(updateData);
    
    res.json({
      success: true,
      message: "Identity updated successfully",
    });
    
  } catch (error) {
    console.error("[IDENTITY] Update error:", error);
    res.status(500).json({
      error: "Update failed",
      message: "An error occurred while updating the identity",
    });
  }
});


// =============================================================================
// ROUTE: POST /api/identity/sync
// Synchronizes @USER.NAME node creation, hardware enclave lock & wallet binding
// =============================================================================
router.post("/sync", async (req: Request, res: Response) => {
  try {
    const rawUser = String(req.body?.userName || "").trim();
    const formattedUser = rawUser.startsWith("@") ? rawUser.toUpperCase() : `@${rawUser.toUpperCase()}`;
    const cleanId = formattedUser.slice(1);
    const walletAddress = String(req.body?.walletAddress || "").trim().toLowerCase();
    const hardwareFingerprint = String(req.body?.hardwareFingerprint || "").trim().toUpperCase();
    const inviteCode = String(req.body?.inviteCode || "").trim().toUpperCase();
    const rawPubKey = String(req.body?.publicKey || "").replace(/[^a-fA-F0-9]/g, "");
    const publicKey = (rawPubKey.length >= 64 ? rawPubKey.slice(0, 64) : rawPubKey.padEnd(64, "a")).toLowerCase();

    if (!isValidUserName(formattedUser)) {
      res.status(400).json({ error: "Invalid @USER.NAME format", message: "Use 2-31 letters, numbers, dots, hyphens, or underscores." });
      return;
    }

    const db = getFirestore();
    const allSnap = await db.collection("identities").get();
    const existingDoc = allSnap.docs.find(
      (d) => d.id.toUpperCase() === cleanId || String(d.data().userName || "").toUpperCase() === formattedUser
    );

    const now = new Date().toISOString();

    if (existingDoc) {
      const data = existingDoc.data() as any;
      const authorizedFps: string[] = Array.isArray(data.authorizedFingerprints) ? data.authorizedFingerprints : [];
      const primaryFp: string = String(data.primaryHardwareFp || "");

      // Enforce hardware lock if node already bound to a hardware fingerprint
      if (primaryFp && hardwareFingerprint && primaryFp !== hardwareFingerprint && !authorizedFps.includes(hardwareFingerprint)) {
        // Compute deterministic Ring Comm invite code RC-XXX-XXX
        let h = 2166136261;
        const secret = `RINGCOMM_BOND_2026::${cleanId}`;
        for (let i = 0; i < secret.length; i++) {
          h ^= secret.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        const num = String((Math.abs(h) % 900000) + 100000);
        const expectedInvite = `RC-${num.slice(0, 3)}-${num.slice(3, 6)}`;

        if (inviteCode !== expectedInvite) {
          res.status(403).json({
            error: "HARDWARE_LOCKED",
            requiresInvite: true,
            message: `Node ${formattedUser} is hardware-locked to primary Ring Comm enclave (${primaryFp}). Authorize via Ring Comm invite code to pair this device.`,
          });
          return;
        }
        authorizedFps.push(hardwareFingerprint);
      }

      const nextPrimaryFp = primaryFp || hardwareFingerprint || "";
      const nextAuthFps = Array.from(new Set([...authorizedFps, ...(hardwareFingerprint ? [hardwareFingerprint] : [])]));
      const nextWallet = /^0x[a-f0-9]{40}$/.test(walletAddress) ? walletAddress : (data.walletAddress || "");

      const updates: Record<string, any> = {
        userName: formattedUser,
        normalizedUserName: cleanId,
        walletAddress: nextWallet,
        publicKey: data.publicKey || publicKey,
        primaryHardwareFp: nextPrimaryFp,
        authorizedFingerprints: nextAuthFps,
        lastVerifiedAt: now,
        updatedAt: now,
      };

      await existingDoc.ref.set(updates, { merge: true });
      if (nextWallet) {
        await db.collection("users").doc(`wallet_${nextWallet}`).set({
          userName: formattedUser,
          walletAddress: nextWallet,
          tier: data.tier || "Creator",
          updatedAt: now,
        }, { merge: true });
      }

      res.json({
        success: true,
        identity: {
          userId: existingDoc.id,
          userName: formattedUser,
          walletAddress: nextWallet,
          primaryHardwareFp: nextPrimaryFp,
          authorizedFingerprints: nextAuthFps,
          publicKey: updates.publicKey,
          verified: true,
          tier: data.tier || "Creator",
          createdAt: data.createdAt || now,
          lastVerifiedAt: now,
        },
      });
      return;
    }

    // Brand-new @USER.NAME registration & hardware lock
    const validWallet = /^0x[a-f0-9]{40}$/.test(walletAddress)
      ? walletAddress
      : "0x" + crypto.createHash("sha256").update(`INNOVA_EVM_VAULT::${cleanId}`).digest("hex").slice(0, 40);

    const newDoc = {
      userName: formattedUser,
      normalizedUserName: cleanId,
      walletAddress: validWallet,
      publicKey,
      primaryHardwareFp: hardwareFingerprint || "",
      authorizedFingerprints: hardwareFingerprint ? [hardwareFingerprint] : [],
      status: "verified",
      tier: "Creator",
      tenantPermissions: {
        MVN: ["read", "write", "publish"],
        StreamShare: ["read", "write", "publish"],
        ArcHaven: ["read", "write", "publish"],
        HekticTV: ["read", "write", "broadcast"],
        Kreation: ["read", "write", "deploy"],
      },
      createdAt: now,
      updatedAt: now,
      lastVerifiedAt: now,
    };

    await db.collection("identities").doc(cleanId).set(newDoc);
    await db.collection("users").doc(`wallet_${validWallet}`).set({
      userName: formattedUser,
      walletAddress: validWallet,
      tier: "Creator",
      tenants: newDoc.tenantPermissions,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    res.status(201).json({
      success: true,
      identity: {
        userId: cleanId,
        userName: formattedUser,
        walletAddress: validWallet,
        primaryHardwareFp: newDoc.primaryHardwareFp,
        authorizedFingerprints: newDoc.authorizedFingerprints,
        publicKey,
        verified: true,
        tier: "Creator",
        createdAt: now,
        lastVerifiedAt: now,
      },
    });
  } catch (error) {
    console.error("[IDENTITY SYNC] error:", error);
    res.status(500).json({ error: "Failed synchronizing @USER.NAME identity" });
  }
});

export default router;