import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const walletAddress = process.env.NEXT_PUBLIC_WALLET_ADDRESS || '';

  if (!walletAddress) {
    return res.status(500).json({
      success: false,
      balance: 0,
      error: 'Wallet address not configured',
    });
  }

  try {
    // Scrape USDC balance from PolygonScan page
    const url = `https://polygonscan.com/address/${walletAddress}`;

    console.log('💰 Fetching USDC balance for:', walletAddress);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    const html = await response.text();

    // Look for USDC balance in the HTML
    // Find all USDC amounts and take the largest one (which is typically the actual balance)
    const usdcPatterns = [
      /([0-9,.]+)[^<]{0,20}USDC/gi,  // Matches numbers before USDC
      />([0-9,.]+)\s+USDC/gi,  // Matches ">523 USDC"
      /<td>([0-9,.]+)<\/td>[\s\S]{0,100}USDC\.?e?/gi, // Table cell with USDC nearby
    ];

    const allBalances: number[] = [];

    // Collect all potential USDC balances
    for (const pattern of usdcPatterns) {
      const matches = html.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          const parsedBalance = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(parsedBalance) && parsedBalance > 0) {
            allBalances.push(parsedBalance);
          }
        }
      }
    }

    // Get the largest balance (most likely the actual wallet balance)
    const balance = allBalances.length > 0 ? Math.max(...allBalances) : 0;

    if (balance > 0) {
      console.log('✅ USDC balance found:', balance);
      return res.status(200).json({
        success: true,
        balance,
        address: walletAddress,
        currency: 'USDC',
        chain: 'Polygon',
      });
    } else {
      console.log('⚠️ USDC balance not found on page');
      return res.status(200).json({
        success: false,
        balance: 0,
        error: 'USDC balance not found on page',
      });
    }
  } catch (error) {
    console.error('❌ Error fetching USDC balance:', error);
    return res.status(500).json({
      success: false,
      balance: 0,
      error: 'Failed to fetch balance',
    });
  }
}
