import express, { Request, Response } from 'express';

const router = express.Router();

// Simulated global ledger for the prototype (Maps Wallet Address -> Token Balance)
const ecosystemLedger = new Map<string, number>();
const DEFAULT_BALANCE = 0;

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
  const balance = ecosystemLedger.has(walletAddress) ? ecosystemLedger.get(walletAddress) : DEFAULT_BALANCE;
  res.json({ balance });
});

router.post('/mint', (req: Request, res: Response) => {
  const { amount, walletAddress, paymentMethod } = req.body;
  
  if (!amount || !walletAddress) {
    return res.status(400).json({ error: 'Amount and wallet address required' });
  }

  // Simulate banking/Stripe processing delay
  setTimeout(() => {
    const currentBalance = ecosystemLedger.has(walletAddress) ? ecosystemLedger.get(walletAddress)! : DEFAULT_BALANCE;
    const newBalance = currentBalance + amount;
    
    // Update the ledger
    ecosystemLedger.set(walletAddress, newBalance);
    
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
    const currentBalance = ecosystemLedger.has(walletAddress) ? ecosystemLedger.get(walletAddress) : DEFAULT_BALANCE;
    const newBalance = currentBalance + amount;
    
    // Update the ledger with the minted tokens
    ecosystemLedger.set(walletAddress, newBalance);
    
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
    
    const currentBalance = ecosystemLedger.has(walletAddress) ? ecosystemLedger.get(walletAddress)! : DEFAULT_BALANCE;
    
    if (currentBalance < amount) {
      return res.status(400).json({ error: 'Insufficient $INVA balance for subscription', currentBalance, required: amount });
    }
    
    const newBalance = currentBalance - amount;
    ecosystemLedger.set(walletAddress, newBalance);
    
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

  const currentBalance = ecosystemLedger.has(walletAddress) ? ecosystemLedger.get(walletAddress)! : DEFAULT_BALANCE;
  
  if (currentBalance < amount) {
    return res.status(400).json({ error: 'Insufficient $INVA balance', currentBalance });
  }

  // Deduct the tokens
  const newBalance = currentBalance - amount;
  ecosystemLedger.set(walletAddress, newBalance);
  
  // Log the specific SaaS / Eco-commerce transaction
  console.log(`[WALLET ENGINE] TX [${txType.toUpperCase()}] - Deducted ${amount} $INVA from ${walletAddress}`);
  if (details) console.log(`[WALLET ENGINE] Details: ${details}`);
  
  res.json({ 
    success: true, 
    newBalance, 
    receipt: `tx_${txType}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  });
});

export default router;
