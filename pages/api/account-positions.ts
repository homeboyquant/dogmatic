import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Use the wallet address from environment variable
    const walletAddress = process.env.NEXT_PUBLIC_WALLET_ADDRESS || '0x1ab25d0244a921340386f5f286405e597716890a';

    const url = `https://data-api.polymarket.com/positions?user=${walletAddress}&limit=100&sortBy=CURRENT&sortDirection=DESC`;

    console.log('🔍 Fetching account positions for:', walletAddress);

    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Polymarket Data API error:', errorText);
      return res.status(response.status).json({ error: 'Failed to fetch positions', details: errorText });
    }

    const data = await response.json();

    console.log('✅ Account positions:', data.length, 'positions found');

    return res.status(200).json(data);
  } catch (error: any) {
    console.error('❌ Account positions error:', error);
    return res.status(500).json({
      error: 'Failed to fetch account positions',
      details: error.message,
    });
  }
}
