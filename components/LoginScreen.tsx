import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import styles from './LoginScreen.module.css';

export default function LoginScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = login(password);
    if (!success) {
      setError(true);
      setPassword('');
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.logo}>
          <img src="/pitbull.png" alt="Polydogs" className={styles.logoImage} />
        </div>

        <h1 className={styles.title}>POLYDOGS</h1>
        <p className={styles.subtitle}>Polymarket Trading Journal</p>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <input
              type="password"
              className={`${styles.input} ${error ? styles.inputError : ''}`}
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && (
              <div className={styles.error}>Incorrect password</div>
            )}
          </div>

          <button type="submit" className={styles.button}>
            <span>Continue</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </form>

        <div className={styles.hint}>Hint: dogmatic</div>
      </div>
    </div>
  );
}
