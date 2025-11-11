import type { NextApiRequest, NextApiResponse } from 'next';
import { doc, setDoc, getDoc, db } from '@/lib/firebase';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Test write
    const testDocRef = doc(db, 'test_collection', 'test_document');
    const testData = {
      message: 'Test write from API',
      timestamp: new Date().toISOString(),
      randomNumber: Math.random(),
    };

    console.log('📝 Writing to Firestore:', testData);
    await setDoc(testDocRef, testData);
    console.log('✅ Write successful');

    // Test read
    console.log('📖 Reading from Firestore...');
    const docSnap = await getDoc(testDocRef);

    if (docSnap.exists()) {
      const readData = docSnap.data();
      console.log('✅ Read successful:', readData);

      res.status(200).json({
        success: true,
        message: 'Firestore test passed!',
        written: testData,
        read: readData,
      });
    } else {
      console.log('❌ Document not found after write');
      res.status(500).json({
        success: false,
        error: 'Document not found after write',
      });
    }
  } catch (error) {
    console.error('❌ Firestore test error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error,
    });
  }
}
