import express, { Request, Response } from 'express';

const router = express.Router();

// Simulated global ledger for the prototype (Maps Wallet Address -> Token Balance)
const ecosystemLedger = new Map<string, number>();
const DEFAULT_BALANCE = 0;

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
