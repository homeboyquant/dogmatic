import { useState, useEffect, useCallback } from 'react';

interface TimerState {
  duration: number; // in minutes
  targetTime: number | null; // timestamp when timer should end
  isActive: boolean;
}

const STORAGE_KEY = 'trading_timer_state';

export function useTimer() {
  const [timerState, setTimerState] = useState<TimerState>(() => {
    if (typeof window === 'undefined') {
      return { duration: 30, targetTime: null, isActive: false };
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Check if timer has expired
        if (parsed.targetTime && parsed.targetTime < Date.now()) {
          return { duration: parsed.duration, targetTime: null, isActive: false };
        }
        return parsed;
      }
    } catch (e) {
      console.error('Failed to load timer state:', e);
    }

    return { duration: 30, targetTime: null, isActive: false };
  });

  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(timerState));
    }
  }, [timerState]);

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
