import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { ethers } from 'ethers';

const CLOB_API_URL = 'https://clob.polymarket.com';
const CHAIN_ID = 137; // Polygon mainnet

/**
 * Derive CLOB API credentials from private key using EIP-712 signature
 *
 * This endpoint uses the Polymarket CLOB API's derive-api-key endpoint to
 * generate API credentials (apiKey, secret, passphrase) from a wallet's private key.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get private key from environment
    const privateKey = process.env.NEXT_PUBLIC_TRADING_PRIVATE_KEY || '';
    if (!privateKey) {
      return res.status(500).json({ error: 'Trading private key not configured' });
    }

    // Create wallet from private key
    const wallet = new ethers.Wallet(privateKey);
    const walletAddress = wallet.address;

    console.log('🔑 Deriving CLOB API credentials for wallet:', walletAddress);

    // Generate timestamp and nonce
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = 0;

    // EIP-712 Domain
    const domain = {
      name: 'ClobAuthDomain',
      version: '1',
      chainId: CHAIN_ID,
    };

    // EIP-712 Message Type
    const types = {
      ClobAuth: [
        { name: 'address', type: 'address' },
        { name: 'timestamp', type: 'string' },
        { name: 'nonce', type: 'uint256' },
        { name: 'message', type: 'string' },
      ],
    };

    // EIP-712 Message Value
    const value = {
      address: walletAddress,
      timestamp: timestamp.toString(),
      nonce: nonce,
      message: 'This message attests that I control the given wallet',
    };

    console.log('📝 Signing EIP-712 message...');

    // Sign the EIP-712 message
    const signature = await wallet.signTypedData(domain, types, value);

    console.log('✅ Signature created:', signature.substring(0, 20) + '...');

    // Call derive-api-key endpoint
    const response = await axios.get(`${CLOB_API_URL}/auth/derive-api-key`, {
      headers: {
        'POLY-ADDRESS': walletAddress,
        'POLY-SIGNATURE': signature,
        'POLY-TIMESTAMP': timestamp.toString(),
        'POLY-NONCE': nonce.toString(),
      },
    });

    console.log('✅ API credentials derived successfully');

    return res.status(200).json({
      success: true,
      credentials: response.data,
      walletAddress,
    });

  } catch (error: any) {
    console.error('❌ Error deriving CLOB credentials:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to derive CLOB credentials',
      details: error.response?.data || error.message,
    });
  }
}
