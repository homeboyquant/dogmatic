import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import crypto from 'crypto';
import { ethers } from 'ethers';

const CLOB_API_URL = 'https://clob.polymarket.com';

interface ClobCredentials {
  apiKey: string;
  secret: string;
  passPhrase: string;
  walletAddress: string;
}

/**
 * Generate authentication headers for Polymarket CLOB API
 */
function generateAuthHeaders(
  credentials: ClobCredentials,
  method: string,
  requestPath: string,
  body?: any
): Record<string, string> {
  const timestamp = (Date.now() / 1000).toFixed(3);
  const bodyStr = body ? JSON.stringify(body) : '';
  const message = `${timestamp}${method}${requestPath}${bodyStr}`;

  const hmac = crypto.createHmac('sha256', Buffer.from(credentials.secret, 'base64'));
  const signature = hmac.update(message).digest('base64');

  return {
    'POLY-ADDRESS': credentials.walletAddress,
    'POLY-SIGNATURE': signature,
    'POLY-TIMESTAMP': timestamp,
    'POLY-PASSPHRASE': credentials.passPhrase,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tokenId, size, price } = req.body;

    if (!tokenId || !size) {
      return res.status(400).json({ error: 'Missing required fields: tokenId, size' });
    }

    // Derive wallet address from private key
    const privateKey = process.env.NEXT_PUBLIC_TRADING_PRIVATE_KEY || '';
    if (!privateKey) {
      return res.status(500).json({ error: 'Trading private key not configured' });
    }

    const wallet = new ethers.Wallet(privateKey);
    const walletAddress = wallet.address;

    const credentials: ClobCredentials = {
      apiKey: process.env.NEXT_PUBLIC_CLOB_API_KEY || '',
      secret: process.env.NEXT_PUBLIC_CLOB_SECRET || '',
      passPhrase: process.env.NEXT_PUBLIC_CLOB_PASS_PHRASE || '',
      walletAddress,
    };

    if (!credentials.apiKey || !credentials.secret || !credentials.passPhrase) {
      return res.status(500).json({ error: 'CLOB credentials not configured' });
    }

    console.log('🔴 Placing SELL order via CLOB API');
    console.log('Token ID:', tokenId);
    console.log('Size:', size);
    console.log('Wallet:', walletAddress);

    // Create a market sell order
    // This is a placeholder - actual CLOB API order creation requires:
    // 1. Getting current market price
    // 2. Creating order with proper signature
    // 3. Submitting to CLOB API

    // For now, return an informative error
    return res.status(501).json({
      error: 'Direct CLOB sell orders not yet implemented',
      message: 'Account Mode positions require direct CLOB API integration. Please sell this position on Polymarket.com',
      details: {
        tokenId,
        size,
        walletAddress,
        suggestedUrl: `https://polymarket.com/`
      }
    });

  } catch (error: any) {
    console.error('❌ Error selling CLOB position:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to sell position',
      details: error.response?.data || error.message,
    });
  }
}
