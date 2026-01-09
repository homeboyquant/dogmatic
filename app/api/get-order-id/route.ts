import { NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { ethers } from 'ethers';

export const dynamic = 'force-dynamic';

interface Trade {
  id: string;
  taker_order_id: string;
  market: string;
  asset_id: string;
  side: 'BUY' | 'SELL';
  size: string;
  price: string;
  match_time: string;
  outcome: string;
}

interface ApiKeyCreds {
  key: string;
  secret: string;
  passphrase: string;
}

// Create EIP-712 signature for L1 auth (to derive API key)
async function createEIP712Signature(
  wallet: ethers.Wallet,
  chainId: number,
  timestamp: number,
  nonce: number = 0
): Promise<string> {
  const domain = {
    name: "ClobAuthDomain",
    version: "1",
    chainId: chainId,
  };

  const types = {
    ClobAuth: [
      { name: "address", type: "address" },
      { name: "timestamp", type: "string" },
      { name: "nonce", type: "uint256" },
      { name: "message", type: "string" },
    ],
  };

  const value = {
    address: wallet.address,
    timestamp: timestamp.toString(),
    nonce,
    message: "This message attests that I control the given wallet",
  };

  const signature = await wallet.signTypedData(domain, types, value);
  return signature;
}

// Create HMAC signature for L2 auth (authenticated API calls)
function createHmacSignature(
  secret: string,
  timestamp: string,
  method: string,
  requestPath: string,
  body: string = ''
): string {
  const message = timestamp + method + requestPath + body;
  return crypto.createHmac('sha256', Buffer.from(secret, 'base64'))
    .update(message)
    .digest('base64');
}

export async function POST(request: Request) {
  try {
    const { token_id } = await request.json();

    if (!token_id) {
      return NextResponse.json(
        { error: 'Missing required field: token_id' },
        { status: 400 }
      );
    }

    // Get private key from env
    const privateKey = process.env.WALLET_PRIVATE_KEY?.replace(/'/g, '');

    if (!privateKey) {
      return NextResponse.json(
        { error: 'Private key not configured' },
        { status: 500 }
      );
    }

    console.log('📊 Fetching order_id for token:', token_id);

    // Create wallet from private key
    const wallet = new ethers.Wallet(privateKey);
    const chainId = 137; // Polygon mainnet

    // Step 1: Derive API key using L1 auth (EIP-712 signature)
    console.log('🔑 Deriving API credentials...');
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = 0;

    const eip712Signature = await createEIP712Signature(wallet, chainId, timestamp, nonce);

    const deriveResponse = await fetch('https://clob.polymarket.com/auth/derive-api-key', {
      method: 'GET',
      headers: {
        'POLY_ADDRESS': wallet.address,
        'POLY_SIGNATURE': eip712Signature,
        'POLY_TIMESTAMP': timestamp.toString(),
        'POLY_NONCE': nonce.toString(),
      },
    });

    if (!deriveResponse.ok) {
      const errorText = await deriveResponse.text();
      console.error('❌ Failed to derive API key:', deriveResponse.status, errorText);
      return NextResponse.json(
        { error: `Failed to derive API key: ${deriveResponse.status} ${errorText}` },
        { status: 500 }
      );
    }

    const apiKeyData: { apiKey: string; secret: string; passphrase: string } = await deriveResponse.json();
    const creds: ApiKeyCreds = {
      key: apiKeyData.apiKey,
      secret: apiKeyData.secret,
      passphrase: apiKeyData.passphrase,
    };

    console.log('✅ API credentials derived successfully');

    // Step 2: Use derived credentials to fetch trades with L2 auth (HMAC)
    const tradesTimestamp = Math.floor(Date.now() / 1000).toString();
    const method = 'GET';
    const requestPath = '/trades';

    const hmacSignature = createHmacSignature(creds.secret, tradesTimestamp, method, requestPath);

    const tradesResponse = await fetch(`https://clob.polymarket.com${requestPath}`, {
      method,
      headers: {
        'POLY_ADDRESS': wallet.address,
        'POLY_API_KEY': creds.key,
        'POLY_SIGNATURE': hmacSignature,
        'POLY_TIMESTAMP': tradesTimestamp,
        'POLY_PASSPHRASE': creds.passphrase,
        'Content-Type': 'application/json',
      },
    });

    if (!tradesResponse.ok) {
      const errorText = await tradesResponse.text();
      console.error('❌ CLOB API error:', tradesResponse.status, errorText);
      return NextResponse.json(
        { error: `CLOB API error: ${tradesResponse.status} ${errorText}` },
        { status: 500 }
      );
    }

    const tradesData = await tradesResponse.json();
    console.log('📦 Trades response:', typeof tradesData, Array.isArray(tradesData) ? tradesData.length : 'not an array');

    // CLOB API might return trades in different formats
    let allTrades: Trade[] = [];
    if (Array.isArray(tradesData)) {
      allTrades = tradesData;
    } else if (tradesData && typeof tradesData === 'object' && tradesData.data) {
      allTrades = tradesData.data;
    } else {
      console.error('❌ Unexpected trades format:', tradesData);
      return NextResponse.json(
        { error: 'Unexpected response format from CLOB API' },
        { status: 500 }
      );
    }

    console.log(`✅ Fetched ${allTrades.length} trades`);

    // Find trades for this specific asset
    const assetTrades = allTrades.filter((t: Trade) => t.asset_id === token_id);
    console.log(`🔍 Found ${assetTrades.length} trades for this asset`);

    if (assetTrades.length === 0) {
      return NextResponse.json(
        { error: 'No trades found for this token_id' },
        { status: 404 }
      );
    }

    // Find the most recent BUY trade to get the order_id
    const buyTrades = assetTrades.filter((t: Trade) => t.side === 'BUY');
    if (buyTrades.length === 0) {
      return NextResponse.json(
        { error: 'No buy trades found for this position' },
        { status: 404 }
      );
    }

    // Sort by match_time descending to get most recent
    buyTrades.sort((a: Trade, b: Trade) => {
      const aTime = parseInt(a.match_time);
      const bTime = parseInt(b.match_time);
      return bTime - aTime;
    });

    const mostRecentBuy = buyTrades[0];
    const order_id = mostRecentBuy.taker_order_id;

    console.log('🎯 Found order_id:', order_id);

    return NextResponse.json({
      success: true,
      order_id,
      trade: mostRecentBuy
    });
  } catch (error: any) {
    console.error('❌ Error fetching order_id:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: 500 }
    );
  }
}
