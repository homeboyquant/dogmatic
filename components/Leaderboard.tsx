import { useState, useEffect } from 'react';
import styles from './Leaderboard.module.css';

interface LeaderboardEntry {
  rank: string;
  proxyWallet: string;
  userName: string;
  xUsername: string;
  verifiedBadge: boolean;
  vol: number;
  pnl: number;
  profileImage: string;
}

interface LeaderboardProps {
  timeWindow?: '1d' | '7d' | '30d' | 'all';
  limit?: number;
}

export default function Leaderboard({ timeWindow = '1d', limit = 10 }: LeaderboardProps) {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWindow] = useState<'1d' | '7d' | '30d' | 'all'>(timeWindow);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      console.log(`🏆 Fetching leaderboard for window: ${selectedWindow}`);
      try {
        const response = await fetch(`/api/leaderboard?window=${selectedWindow}&limit=${limit}`);
        if (!response.ok) throw new Error('Failed to fetch leaderboard');

        const data = await response.json();
        console.log(`✅ Leaderboard data received for ${selectedWindow}:`, data.slice(0, 3));
        setLeaders(data);
      } catch (error) {
        console.error('❌ Error fetching leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [selectedWindow, limit]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  };

  const shortenAddress = (address: string) => {
    if (address.length < 20) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getDisplayName = (entry: LeaderboardEntry) => {
    if (entry.userName && !entry.userName.startsWith('0x')) {
      return entry.userName;
    }
    return shortenAddress(entry.proxyWallet);
  };

  const getProfileUrl = (entry: LeaderboardEntry) => {
    // Use username if available, otherwise use wallet address
    const identifier = entry.userName && !entry.userName.startsWith('0x')
      ? entry.userName
      : entry.proxyWallet;
    return `https://polymarket.com/@${identifier}`;
  };

  const handleTraderClick = (entry: LeaderboardEntry) => {
    window.open(getProfileUrl(entry), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h2 className={styles.title}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={styles.icon}>
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
            </svg>
            Top Traders
          </h2>
          <p className={styles.subtitle}>
            Ranked by profit · <span className={styles.timeBadge}>Last 24 hours</span>
          </p>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading leaderboard...</p>
        </div>
      ) : (
        <div className={styles.leaderboard}>
          {leaders.map((entry, index) => (
            <div
              key={entry.proxyWallet}
              className={styles.entry}
              onClick={() => handleTraderClick(entry)}
            >
              <div className={styles.rankSection}>
                <span className={`${styles.rank} ${index < 3 ? styles[`rank${index + 1}`] : ''}`}>
                  {index < 3 ? ['🥇', '🥈', '🥉'][index] : `#${entry.rank}`}
                </span>
              </div>

              <div className={styles.userSection}>
                <div className={styles.userName}>
                  {getDisplayName(entry)}
                  {entry.verifiedBadge && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={styles.verifiedBadge}>
                      <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="#3b82f6"/>
                    </svg>
                  )}
                </div>
                <div className={styles.stats}>
                  <span className={styles.volume}>Vol: {formatCurrency(entry.vol)}</span>
                </div>
              </div>

              <div className={styles.pnlSection}>
                <div className={styles.pnl}>
                  {formatCurrency(entry.pnl)}
                </div>
                <div className={styles.pnlLabel}>Profit</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
