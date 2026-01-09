import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import crypto from 'crypto';
import { ethers } from 'ethers';

const CLOB_API_URL = 'https://clob.polymarket.com';

// Helper to derive CLOB credentials from private key (same as sell-position.ts)
function deriveClobCredentials(privateKey: string) {
  const wallet = new ethers.Wallet(privateKey);
  const apiKey = wallet.address.toLowerCase();

  // Derive deterministic secret and passphrase
  const hash = crypto.createHash('sha256').update(privateKey).digest();
  const secret = hash.toString('base64');
  const passPhrase = crypto.createHash('sha256').update(hash).digest('hex');

  return { apiKey, secret, passPhrase, address: wallet.address };
}

/**
 * Generate authentication headers for Polymarket CLOB API
 */
function generateAuthHeaders(
  credentials: { apiKey: string; secret: string; passPhrase: string; address: string },
  method: string,
  requestPath: string,
  body?: any
): Record<string, string> {
  const timestamp = (Date.now() / 1000).toFixed(3);
  const bodyStr = body ? JSON.stringify(body) : '';
  const message = `${timestamp}${method}${requestPath}${bodyStr}`;

  const hmac = crypto.createHmac('sha256', Buffer.from(credentials.secret, 'base64'));
  const signature = hmac.update(message).digest('base64');

  console.log('🔐 Auth details:', {
    timestamp,
    method,
    path: requestPath,
    messageLength: message.length,
  });

  return {
    'POLY-ADDRESS': credentials.address,
    'POLY-SIGNATURE': signature,
    'POLY-TIMESTAMP': timestamp,
    'POLY-PASSPHRASE': credentials.passPhrase,
    'POLY-API-KEY': credentials.apiKey,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use stored CLOB credentials (same as homeboy_monitor)
    const apiKey = process.env.CLOB_API_KEY?.replace(/'/g, '');
    const secret = process.env.CLOB_SECRET?.replace(/'/g, '');
    const passPhrase = process.env.CLOB_PASS_PHRASE?.replace(/'/g, '');
    const walletAddress = process.env.WALLET_PUBLIC_ADDRESS?.replace(/'/g, '');

    if (!apiKey || !secret || !passPhrase || !walletAddress) {
      return res.status(500).json({ error: 'CLOB credentials not configured' });
    }

    const credentials = {
      apiKey,
      secret,
      passPhrase,
      address: walletAddress
    };

    console.log('🔑 Using Wallet Address:', credentials.address);

    // Fetch user orders (open positions)
    const ordersPath = '/data/orders';
    const ordersAuthHeaders = generateAuthHeaders(credentials, 'GET', ordersPath);

    console.log('🔍 Fetching orders from Polymarket CLOB...');

    const ordersResponse = await axios.get(`${CLOB_API_URL}${ordersPath}`, {
      headers: {
        ...ordersAuthHeaders,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Orders fetched:', ordersResponse.data?.length || 0, 'orders');

    // Fetch user trades (completed fills)
    const tradesPath = '/data/trades';
    const tradesAuthHeaders = generateAuthHeaders(credentials, 'GET', tradesPath);

    console.log('🔍 Fetching trades from Polymarket CLOB...');

    const tradesResponse = await axios.get(`${CLOB_API_URL}${tradesPath}`, {
      headers: {
        ...tradesAuthHeaders,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Trades fetched:', tradesResponse.data?.length || 0, 'trades');

    // Separate orders into open and closed
    const openOrders = [];
    const closedOrders = [];

    if (Array.isArray(ordersResponse.data)) {
      for (const order of ordersResponse.data) {
        // Orders with status 'LIVE' or 'PARTIAL' are still open
        // Orders with status 'MATCHED', 'CANCELLED', 'EXPIRED' are closed
        if (order.status === 'LIVE' || order.status === 'PARTIAL') {
          openOrders.push(order);
        } else if (order.status === 'MATCHED' || order.status === 'CANCELLED' || order.status === 'EXPIRED') {
          closedOrders.push(order);
        }
      }
    }

    return res.status(200).json({
      success: true,
      orders: ordersResponse.data,
      trades: tradesResponse.data,
      openOrders,
      closedOrders,
      totalOrders: ordersResponse.data?.length || 0,
      totalTrades: tradesResponse.data?.length || 0,
    });

  } catch (error: any) {
    console.error('❌ Error fetching Polymarket orders:', error.response?.data || error.message);
    return res.status(500).json({
      error: 'Failed to fetch orders',
      details: error.response?.data || error.message,
    });
  }
}
