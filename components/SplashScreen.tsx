import { useEffect, useState } from 'react';
import styles from './SplashScreen.module.css';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Start fade out after 2.5 seconds
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 2500);

    // Complete after 3 seconds (including fade transition)
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`${styles.splashContainer} ${fadeOut ? styles.fadeOut : ''}`}>
      <div className={styles.content}>
        <div className={styles.logoContainer}>
          <div className={styles.logo}>
            <img src="/pitbull.png" alt="Dogmatic Fund" className={styles.logoImage} />
          </div>
        </div>

        <h1 className={styles.title}>
          <span className={styles.titleMain}>A Polymarket Fund</span>
        </h1>

        <div className={styles.tagline}>
          Professional prediction market trading
        </div>

        <div className={styles.loadingBar}>
          <div className={styles.loadingProgress}></div>
        </div>
      </div>
    </div>
  );
}
