import { JournalEntry, JournalStats } from '@/types/journal';

const STORAGE_KEY = 'dogmatic_journal_entries';

export const StorageService = {
  // Get all journal entries
  getEntries(): JournalEntry[] {
    if (typeof window === 'undefined') return [];

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error reading journal entries:', error);
      return [];
    }
  },

  // Save all entries
  saveEntries(entries: JournalEntry[]): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
      console.error('Error saving journal entries:', error);
    }
  },

  // Add new entry
  addEntry(entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'>): JournalEntry {
    const entries = this.getEntries();
    const newEntry: JournalEntry = {
      ...entry,
      id: `journal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    entries.unshift(newEntry);
    this.saveEntries(entries);
    return newEntry;
  },

  // Update entry
  updateEntry(id: string, updates: Partial<JournalEntry>): JournalEntry | null {
    const entries = this.getEntries();
    const index = entries.findIndex(e => e.id === id);

    if (index === -1) return null;

    entries[index] = {
      ...entries[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.saveEntries(entries);
    return entries[index];
  },

  // Delete entry
  deleteEntry(id: string): boolean {
    const entries = this.getEntries();
    const filtered = entries.filter(e => e.id !== id);

    if (filtered.length === entries.length) return false;

    this.saveEntries(filtered);
    return true;
  },

  // Get single entry
  getEntry(id: string): JournalEntry | null {
    const entries = this.getEntries();
    return entries.find(e => e.id === id) || null;
  },

  // Calculate statistics
  getStats(): JournalStats {
    const entries = this.getEntries();
    const closedTrades = entries.filter(e => e.status === 'closed');
    const wins = closedTrades.filter(e => e.outcome === 'win');
    const losses = closedTrades.filter(e => e.outcome === 'loss');

    const totalProfitLoss = closedTrades.reduce((sum, e) => sum + (e.profitLoss || 0), 0);
    const profitLosses = closedTrades.map(e => e.profitLoss || 0).filter(p => p !== 0);

    return {
      totalTrades: entries.length,
      openTrades: entries.filter(e => e.status === 'open').length,
      closedTrades: closedTrades.length,
      totalWins: wins.length,
      totalLosses: losses.length,
      winRate: closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0,
      totalProfitLoss,
      avgProfitLoss: profitLosses.length > 0 ? totalProfitLoss / profitLosses.length : 0,
      bestTrade: profitLosses.length > 0 ? Math.max(...profitLosses) : 0,
      worstTrade: profitLosses.length > 0 ? Math.min(...profitLosses) : 0,
    };
  },

  // Export data
  exportData(): string {
    const entries = this.getEntries();
    return JSON.stringify(entries, null, 2);
  },

  // Import data
  importData(jsonData: string): boolean {
    try {
      const entries = JSON.parse(jsonData);
      if (!Array.isArray(entries)) return false;

      this.saveEntries(entries);
      return true;
    } catch (error) {
      console.error('Error importing data:', error);
      return false;
    }
  },
};
