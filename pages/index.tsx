import { useState, useEffect } from 'react';
import Head from 'next/head';
import RealTradingSimulator from '@/components/RealTradingSimulator';
import LoginScreen from '@/components/LoginScreen';
import SplashScreen from '@/components/SplashScreen';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import styles from './landing.module.css';

type View = 'trading' | 'portfolio';

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, logout } = useAuth();
  const [currentView, setCurrentView] = useState<View>('trading');
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    // Check if splash has been shown in this session
    const splashShown = sessionStorage.getItem('splashShown');
    if (splashShown) {
      setShowSplash(false);
    }
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
    sessionStorage.setItem('splashShown', 'true');
  };

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <>
      <Head>
        <title>Polydogs | Trading Journal</title>
        <meta name="description" content="Practice trading on Polymarket with virtual money" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <img src="/pitbull.png" alt="Pitbull" className={styles.logoIcon} />
            <span>POLYDOGS</span>
          </div>
          <div className={styles.nav}>
            <button
              className={`${styles.navButton} ${currentView === 'trading' ? styles.active : ''}`}
              onClick={() => setCurrentView('trading')}
            >
              Markets
            </button>
            <button
              className={`${styles.navButton} ${currentView === 'portfolio' ? styles.active : ''}`}
              onClick={() => setCurrentView('portfolio')}
            >
              Portfolio
            </button>
          </div>
          <div className={styles.headerActions}>
            <button
              className={styles.themeToggle}
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === 'light' ? '☀️' : '🌙'}
            </button>
            <button
              className={styles.logoutButton}
              onClick={logout}
            >
              Logout
            </button>
          </div>
        </div>
        <div className={styles.content}>
          <RealTradingSimulator currentView={currentView} />
        </div>
      </main>
    </>
  );
}
