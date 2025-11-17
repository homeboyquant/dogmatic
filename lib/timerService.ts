import { doc, getDoc, setDoc, db } from './firebase';

export interface TimerState {
  duration: number; // in minutes
  targetTime: number | null; // timestamp when timer should end
  isActive: boolean;
  updatedAt?: number;
}

const COLLECTION = 'timers';

export class TimerService {
  async getTimerState(userId: string): Promise<TimerState> {
    try {
      const docRef = doc(db, COLLECTION, userId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as TimerState;

        // Check if timer has expired
        if (data.targetTime && data.targetTime < Date.now()) {
          const expiredState = {
            duration: data.duration,
            targetTime: null,
            isActive: false
          };
          await this.saveTimerState(userId, expiredState);
          return expiredState;
        }

        return data;
      }

      // Return default state
      return { duration: 30, targetTime: null, isActive: false };
    } catch (error) {
      console.error('❌ Error loading timer state from Firestore:', error);
      return { duration: 30, targetTime: null, isActive: false };
    }
  }

  async saveTimerState(userId: string, timerState: TimerState): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION, userId);

      const cleanTimerData = {
        ...timerState,
        updatedAt: Date.now(),
      };

      await setDoc(docRef, cleanTimerData);
    } catch (error) {
      console.error('❌ Error saving timer state to Firestore:', error);
      throw error;
    }
  }
}

export const timerService = new TimerService();
