import type { NextApiRequest, NextApiResponse } from 'next';
import { doc, getDoc, db } from '@/lib/firebase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const userId = 'dogmatic1';

    // Direct Firestore read - no service layer
    const docRef = doc(db, 'portfolios', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      console.log('📊 Raw Firestore data for dogmatic1:', data);

      res.status(200).json({
        success: true,
        exists: true,
        data: data,
        tradesCount: data.trades?.length || 0,
        positionsCount: data.positions?.length || 0,
      });
    } else {
      console.log('❌ No document found for dogmatic1');
      res.status(200).json({
        success: true,
        exists: false,
        message: 'No portfolio found for dogmatic1',
      });
    }
  } catch (error) {
    console.error('❌ Error checking portfolio:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
