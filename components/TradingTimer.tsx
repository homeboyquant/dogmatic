import { useState, useEffect } from 'react';
import { useTimer } from '@/hooks/useTimer';
import styles from './TradingTimer.module.css';

interface TradingTimerProps {
  currentPnL?: number;
  isInHeader?: boolean;
}

export default function TradingTimer({ currentPnL = 0, isInHeader = false }: TradingTimerProps) {
  const {
    duration,
    isActive,
    timeRemaining,
    timeRemainingFormatted,
    startTimer,
    pauseTimer,
    resetTimer,
    setDuration,
  } = useTimer();

  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [durationInput, setDurationInput] = useState('');
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours' | 'days'>('minutes');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setDurationInput(duration.toString());
  }, [duration]);

  const handleDurationSubmit = () => {
    let newDuration = parseInt(durationInput);
    if (isNaN(newDuration) || newDuration <= 0) return;

    // Convert to minutes based on unit
    if (durationUnit === 'hours') {
      newDuration = newDuration * 60;
    } else if (durationUnit === 'days') {
      newDuration = newDuration * 60 * 24;
    }

    setDuration(newDuration);
    setIsEditingDuration(false);
    resetTimer();
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 1440) {
      const days = minutes / 1440;
      return days === 1 ? '1 day' : `${days} days`;
    } else if (minutes >= 60) {
      const hours = minutes / 60;
      return hours === 1 ? '1 hour' : `${hours} hours`;
    } else {
      return minutes === 1 ? '1 minute' : `${minutes} minutes`;
    }
  };

  const getProgressPercentage = () => {
    if (!isActive || timeRemaining === 0) return 0;
    const totalMs = duration * 60 * 1000;
    return (timeRemaining / totalMs) * 100;
  };

  const isAlmostExpired = isActive && timeRemaining > 0 && timeRemaining < 5 * 60 * 1000; // Last 5 minutes

  return (
    <div className={`${styles.container} ${isExpanded ? styles.expanded : ''} ${isInHeader ? styles.inHeader : ''}`}>
      <div className={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <div className={styles.headerRight}>
          {isActive && (
            <div className={`${styles.timeDisplay} ${isAlmostExpired ? styles.warning : ''}`}>
              <svg className={styles.timeIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span className={styles.timeValue}>{timeRemainingFormatted}</span>
            </div>
          )}

          {!isActive && (
            <div className={styles.durationBadge}>
              <svg className={styles.durationIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
              <span className={styles.durationText}>{formatDuration(duration)}</span>
            </div>
          )}

          <svg
            className={`${styles.chevron} ${isExpanded ? styles.rotated : ''}`}
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className={styles.content}>
          {isActive && (
            <div className={styles.timeProgressSection}>
              <div className={styles.pnlGoalHeader}>
                <span className={styles.pnlGoalLabel}>Time Remaining</span>
                <span className={styles.pnlGoalValue}>{timeRemainingFormatted}</span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={`${styles.progressFill} ${isAlmostExpired ? styles.warning : ''}`}
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
            </div>
          )}

          <div className={styles.controls}>
            {!isActive ? (
              <>
                <div className={styles.durationControl}>
                  <label className={styles.label}>Duration</label>
                  {isEditingDuration ? (
                    <div className={styles.durationEdit}>
                      <input
                        type="number"
                        className={styles.durationInput}
                        value={durationInput}
                        onChange={(e) => setDurationInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleDurationSubmit();
                          if (e.key === 'Escape') {
                            setIsEditingDuration(false);
                            setDurationInput(duration.toString());
                          }
                        }}
                        autoFocus
                        min="1"
                      />
                      <select
                        className={styles.unitSelector}
                        value={durationUnit}
                        onChange={(e) => setDurationUnit(e.target.value as 'minutes' | 'hours' | 'days')}
                      >
                        <option value="minutes">min</option>
                        <option value="hours">hrs</option>
                        <option value="days">days</option>
                      </select>
                      <button
                        className={styles.durationSaveButton}
                        onClick={handleDurationSubmit}
                      >
                        ✓
                      </button>
                      <button
                        className={styles.durationCancelButton}
                        onClick={() => {
                          setIsEditingDuration(false);
                          setDurationInput(duration.toString());
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className={styles.durationDisplay}>
                      <span className={styles.durationValue}>{formatDuration(duration)}</span>
                      <button
                        className={styles.editButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsEditingDuration(true);
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.quickDurations}>
                  <button
                    className={`${styles.quickButton} ${duration === 30 ? styles.selected : ''}`}
                    onClick={() => { setDuration(30); resetTimer(); }}
                  >
                    30m
                  </button>
                  <button
                    className={`${styles.quickButton} ${duration === 60 ? styles.selected : ''}`}
                    onClick={() => { setDuration(60); resetTimer(); }}
                  >
                    1h
                  </button>
                  <button
                    className={`${styles.quickButton} ${duration === 240 ? styles.selected : ''}`}
                    onClick={() => { setDuration(240); resetTimer(); }}
                  >
                    4h
                  </button>
                  <button
                    className={`${styles.quickButton} ${duration === 1440 ? styles.selected : ''}`}
                    onClick={() => { setDuration(1440); resetTimer(); }}
                  >
                    1d
                  </button>
                  <button
                    className={`${styles.quickButton} ${duration === 10080 ? styles.selected : ''}`}
                    onClick={() => { setDuration(10080); resetTimer(); }}
                  >
                    1w
                  </button>
                  <button
                    className={`${styles.quickButton} ${duration === 43200 ? styles.selected : ''}`}
                    onClick={() => { setDuration(43200); resetTimer(); }}
                  >
                    30d
                  </button>
                </div>

                <button className={styles.startButton} onClick={startTimer}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                  Start Timer
                </button>
              </>
            ) : (
              <div className={styles.activeControls}>
                <button className={styles.pauseButton} onClick={pauseTimer}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16"></rect>
                    <rect x="14" y="4" width="4" height="16"></rect>
                  </svg>
                  Pause
                </button>
                <button className={styles.resetButton} onClick={resetTimer}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path>
                    <path d="M21 3v5h-5"></path>
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path>
                    <path d="M3 21v-5h5"></path>
                  </svg>
                  Reset
                </button>
              </div>
            )}
          </div>

          {timeRemaining === 0 && !isActive && duration > 0 && (
            <div className={styles.completedMessage}>
              Time's up! Ready to review your trades?
            </div>
          )}
        </div>
      )}
    </div>
  );
}
