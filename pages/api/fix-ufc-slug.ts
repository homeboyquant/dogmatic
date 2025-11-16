import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { app } from '@/lib/firebase';

const db = getFirestore(app);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const userId = 'dogmatic1';

    const docRef = doc(db, 'portfolios', userId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'Portfolio not found' });
    }

    const portfolio = docSnap.data();

    // Find and fix UFC position
    const updatedPositions = portfolio.positions.map((pos: any) => {
      if (pos.id === '1763058849559') {
        // This is the UFC position - update the marketSlug
        return {
          ...pos,
          marketSlug: 'ufc-isl-jac9-2025-11-15-681', // Correct market slug
        };
      }
      return pos;
    });

    await updateDoc(docRef, {
      positions: updatedPositions,
      updatedAt: Date.now(),
    });

    return res.status(200).json({
      success: true,
      message: 'UFC position marketSlug updated',
      oldSlug: 'ufc-isl-jac9-2025-11-15',
      newSlug: 'ufc-isl-jac9-2025-11-15-681',
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error', details: String(error) });
  }
}
