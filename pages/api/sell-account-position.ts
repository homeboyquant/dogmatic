import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import crypto from 'crypto';
import { ethers } from 'ethers';

const CLOB_API_URL = 'https://clob.polymarket.com';
const TRADING_API_URL = process.env.NEXT_PUBLIC_TRADING_API_URL || 'https://homeboyapi-318538657595.me-west1.run.app';

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
    'POLY_ADDRESS': credentials.walletAddress,
    'POLY_SIGNATURE': signature,
    'POLY_TIMESTAMP': timestamp,
    'POLY_PASSPHRASE': credentials.passPhrase,
    'POLY_API_KEY': credentials.apiKey,
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
    const { tokenId, size } = req.body;

    if (!tokenId || !size) {
      return res.status(400).json({ error: 'Missing required fields: tokenId, size' });
    }

    console.log(`🔴 Selling Account Position - tokenId: ${tokenId}, size: ${size}`);

    // Derive wallet address from private key for CLOB API authentication
    const privateKey = process.env.NEXT_PUBLIC_TRADING_PRIVATE_KEY || '';
    if (!privateKey) {
      return res.status(500).json({ error: 'Trading private key not configured' });
    }

    const wallet = new ethers.Wallet(privateKey);
    const walletAddress = wallet.address;
    const funderAddress = process.env.NEXT_PUBLIC_WALLET_ADDRESS || walletAddress;

    console.log('🔑 Using Wallet Address (signer):', walletAddress);
    console.log('💰 Using Funder Address (proxy):', funderAddress);
    console.log('🔐 Deriving CLOB API credentials from private key...');

    // Derive API credentials using EIP-712 signature
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = 0;

    // EIP-712 Domain
    const domain = {
      name: 'ClobAuthDomain',
      version: '1',
      chainId: 137, // Polygon
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

    // Sign the EIP-712 message
    const eip712Signature = await wallet.signTypedData(domain, types, value);

    console.log('📝 Requesting API credentials from CLOB...');

    // Call derive-api-key endpoint
    const deriveResponse = await axios.get(`${CLOB_API_URL}/auth/derive-api-key`, {
      headers: {
        'POLY_ADDRESS': walletAddress,
        'POLY_SIGNATURE': eip712Signature,
        'POLY_TIMESTAMP': timestamp.toString(),
        'POLY_NONCE': nonce.toString(),
      },
    });

    const credentials: ClobCredentials = {
      apiKey: deriveResponse.data.apiKey,
      secret: deriveResponse.data.secret,
      passPhrase: deriveResponse.data.passphrase,
      walletAddress,
    };

    console.log('✅ API credentials derived successfully');
    console.log('📋 API Key:', credentials.apiKey.substring(0, 10) + '...');

    // First, test if credentials work by fetching ALL orders
    console.log('🧪 Testing credentials by fetching all orders...');
    const testPath = '/data/orders';
    const testAuthHeaders = generateAuthHeaders(credentials, 'GET', testPath);

    try {
      const testResponse = await axios.get(`${CLOB_API_URL}${testPath}`, {
        headers: {
          ...testAuthHeaders,
          'Content-Type': 'application/json',
        },
      });
      console.log('✅ Credentials work! Total orders:', testResponse.data?.length || 0);
      console.log('📊 Sample orders:', JSON.stringify(testResponse.data?.slice(0, 2), null, 2));
    } catch (testError: any) {
      console.log('❌ Credentials test failed:', testError.response?.data);
    }

    console.log('📋 Fetching orders for asset_id (token):', tokenId);

    // Fetch orders from CLOB API filtered by asset_id (token_id)
    // Using query parameter asset_id to filter orders for this specific token
    // Also try filtering by market to see if we get any results
    const ordersPath = `/data/orders?asset_id=${tokenId}`;
    const ordersAuthHeaders = generateAuthHeaders(credentials, 'GET', ordersPath);

    console.log('🔍 Note: If this is a proxy wallet setup, orders might be under the funder address:', funderAddress);

    console.log('🔐 Request headers:', Object.keys(ordersAuthHeaders).join(', '));

    const ordersResponse = await axios.get(`${CLOB_API_URL}${ordersPath}`, {
      headers: {
        ...ordersAuthHeaders,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Orders fetched for token:', ordersResponse.data?.length || 0, 'orders');
    console.log('📊 Orders data:', JSON.stringify(ordersResponse.data, null, 2).substring(0, 500));

    // Find orders with status 'MATCHED' (filled orders)
    const matchingOrders = (ordersResponse.data || []).filter((order: any) =>
      order.status === 'MATCHED'
    );

    if (matchingOrders.length === 0) {
      return res.status(404).json({
        error: 'No matching order found',
        message: 'This position may have been created externally. Please sell it on Polymarket.com',
        details: {
          tokenId,
          walletAddress,
          suggestedUrl: 'https://polymarket.com/'
        }
      });
    }

    // Use the most recent order_id (first in array)
    const order_id = matchingOrders[0].id;
    console.log('✅ Found order_id:', order_id);

    // Now call sell_fast with the found order_id
    console.log('🔴 Calling sell_fast endpoint...');
    const sellResponse = await axios.post(`${TRADING_API_URL}/sell_fast`, {
      token_id: tokenId,
      order_id: order_id,
      sell_percentage: 100
    });

    console.log('✅ Sell successful:', sellResponse.data);
    return res.status(200).json(sellResponse.data);

  } catch (error: any) {
    console.error('❌ Error selling account position:', error.response?.data || error.message);
    console.error('Error status:', error.response?.status);
    console.error('Error headers:', error.response?.headers);
    console.error('Full error:', JSON.stringify(error.response?.data, null, 2));
    return res.status(500).json({
      error: 'Failed to sell position',
      details: error.response?.data || error.message,
      status: error.response?.status,
    });
  }
}
