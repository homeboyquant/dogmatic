import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { timerService, TimerState } from '@/lib/timerService';

export function useTimer() {
  const { userId } = useAuth();
  const [timerState, setTimerState] = useState<TimerState>({
    duration: 30,
    targetTime: null,
    isActive: false
  });

  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load timer state from Firestore
  useEffect(() => {
    if (!userId) return;

    const loadTimerState = async () => {
      try {
        const state = await timerService.getTimerState(userId);
        setTimerState(state);
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to load timer state:', error);
        setIsLoaded(true);
      }
    };

    loadTimerState();
  }, [userId]);

  // Save to Firestore whenever state changes
  useEffect(() => {
    if (!userId || !isLoaded) return;

    const saveTimerState = async () => {
      try {
        await timerService.saveTimerState(userId, timerState);
      } catch (error) {
        console.error('Failed to save timer state:', error);
      }
    };

    saveTimerState();
  }, [timerState, userId, isLoaded]);

  // Update time remaining
  useEffect(() => {
    if (!timerState.isActive || !timerState.targetTime) {
      setTimeRemaining(0);
      return;
    }

    const updateTimeRemaining = () => {
      const remaining = Math.max(0, timerState.targetTime! - Date.now());
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setTimerState(prev => ({ ...prev, isActive: false, targetTime: null }));
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [timerState.isActive, timerState.targetTime]);

  const startTimer = useCallback(() => {
    const targetTime = Date.now() + timerState.duration * 60 * 1000;
    setTimerState(prev => ({ ...prev, targetTime, isActive: true }));
  }, [timerState.duration]);

  const pauseTimer = useCallback(() => {
    setTimerState(prev => ({ ...prev, isActive: false }));
  }, []);

  const resetTimer = useCallback(() => {
    setTimerState(prev => ({ ...prev, targetTime: null, isActive: false }));
  }, []);

  const setDuration = useCallback((duration: number) => {
    setTimerState(prev => ({
      ...prev,
      duration: Math.max(1, duration) // Minimum 1 minute, no maximum
    }));
  }, []);

  const formatTime = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    } else if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  return {
    duration: timerState.duration,
    isActive: timerState.isActive,
    timeRemaining,
    timeRemainingFormatted: formatTime(timeRemaining),
    startTimer,
    pauseTimer,
    resetTimer,
    setDuration,
  };
}
