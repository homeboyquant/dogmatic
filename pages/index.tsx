import { useState } from 'react';
import Head from 'next/head';
import TradingSimulator from '@/components/TradingSimulator';
import LoginScreen from '@/components/LoginScreen';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import styles from './landing.module.css';

type View = 'trading' | 'portfolio';

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const { isAuthenticated, logout } = useAuth();
  const [currentView, setCurrentView] = useState<View>('trading');

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
          <div className={styles.logo}>Polydogs</div>
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
          <TradingSimulator currentView={currentView} />
        </div>
        <footer className={styles.footer}>
          <iframe src={`https://ticker.polymarket.com/embed?category=Breaking News&theme=${theme}&speed=1&displayMode=classic`} width="100%" height="60" frameBorder="0" scrolling="no" style={{ border: 'none', overflow: 'hidden', display: 'block', margin: 0, padding: 0, verticalAlign: 'bottom' }}></iframe>
        </footer>
      </main>
    </>
  );
}
