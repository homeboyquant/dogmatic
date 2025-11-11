import { useState, useEffect } from 'react';
import { JournalEntry } from '@/types/journal';
import { Event } from '@/types/polymarket';
import { StorageService } from '@/lib/storage';
import styles from './JournalForm.module.css';

interface JournalFormProps {
  editingId: string | null;
  onClose: () => void;
}

export default function JournalForm({ editingId, onClose }: JournalFormProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string>('');

  const [formData, setFormData] = useState({
    position: 'yes' as 'yes' | 'no',
    entryPrice: '',
    size: '',
    entryDate: new Date().toISOString().split('T')[0],
    thesis: '',
    reasoning: '',
    edge: '',
    confidence: '7',
    tags: '',
    notes: '',

    // For closed trades
    status: 'open' as 'open' | 'closed',
    exitPrice: '',
    exitDate: '',
  });

  useEffect(() => {
    if (editingId) {
      const entry = StorageService.getEntry(editingId);
      if (entry) {
        setFormData({
          position: entry.position,
          entryPrice: entry.entryPrice.toString(),
          size: entry.size.toString(),
          entryDate: entry.entryDate.split('T')[0],
          thesis: entry.thesis,
          reasoning: entry.reasoning,
          edge: entry.edge,
          confidence: entry.confidence.toString(),
          tags: entry.tags.join(', '),
          notes: entry.notes || '',
          status: entry.status,
          exitPrice: entry.exitPrice?.toString() || '',
          exitDate: entry.exitDate?.split('T')[0] || '',
        });

        // Simulate selected event
        setSelectedEvent({
          id: entry.eventId,
          title: entry.eventTitle,
          slug: entry.eventSlug,
          image: entry.eventImage,
          markets: [{ question: entry.marketQuestion }],
        } as Event);
        setSelectedMarket(entry.marketQuestion);
      }
    }
  }, [editingId]);

  useEffect(() => {
    const searchEvents = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        const response = await fetch(`/api/events?limit=50&closed=false`);
        const data = await response.json();

        const filtered = data.filter((event: Event) =>
          event.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          event.active
        ).slice(0, 10);

        setSearchResults(filtered);
      } catch (error) {
        console.error('Error searching events:', error);
      }
    };

    const debounce = setTimeout(searchEvents, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedEvent || !selectedMarket) {
      alert('Please select a Polymarket event and market');
      return;
    }

    const entryPrice = parseFloat(formData.entryPrice);
    const size = parseFloat(formData.size);
    const confidence = parseInt(formData.confidence);

    if (isNaN(entryPrice) || isNaN(size) || isNaN(confidence)) {
      alert('Please enter valid numbers for price, size, and confidence');
      return;
    }

    const tags = formData.tags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const entry: Omit<JournalEntry, 'id' | 'createdAt' | 'updatedAt'> = {
      eventId: selectedEvent.id,
      eventTitle: selectedEvent.title,
      eventSlug: selectedEvent.slug,
      eventImage: selectedEvent.image,
      marketQuestion: selectedMarket,
      position: formData.position,
      entryPrice,
      size,
      entryDate: formData.entryDate,
      thesis: formData.thesis,
      reasoning: formData.reasoning,
      edge: formData.edge,
      confidence,
      status: formData.status,
      tags,
      notes: formData.notes,
    };

    // Calculate P&L if closed
    if (formData.status === 'closed' && formData.exitPrice) {
      const exitPrice = parseFloat(formData.exitPrice);
      if (!isNaN(exitPrice)) {
        entry.exitPrice = exitPrice;
        entry.exitDate = formData.exitDate;

        const priceDiff = formData.position === 'yes'
          ? (exitPrice - entryPrice)
          : (entryPrice - exitPrice);

        entry.profitLoss = priceDiff * size;
        entry.profitLossPercent = (priceDiff / entryPrice) * 100;
        entry.outcome = entry.profitLoss > 0 ? 'win' : entry.profitLoss < 0 ? 'loss' : 'breakeven';
      }
    }

    if (editingId) {
      StorageService.updateEntry(editingId, entry);
    } else {
      StorageService.addEntry(entry);
    }

    onClose();
  };

  return (
    <div className={styles.container}>
      <div className={styles.formCard}>
        <div className={styles.header}>
          <h2>{editingId ? 'Edit Entry' : 'New Journal Entry'}</h2>
          <button className={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Event Search */}
          {!editingId && (
            <div className={styles.section}>
              <label className={styles.sectionLabel}>🎯 Polymarket Event</label>

              {!selectedEvent ? (
                <div className={styles.searchContainer}>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Search for a Polymarket event..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    required
                  />

                  {searchResults.length > 0 && (
                    <div className={styles.searchResults}>
                      {searchResults.map(event => (
                        <div
                          key={event.id}
                          className={styles.searchResult}
                          onClick={() => {
                            setSelectedEvent(event);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                        >
                          {event.image && <img src={event.image} alt="" className={styles.resultImage} />}
                          <div className={styles.resultText}>
                            <div className={styles.resultTitle}>{event.title}</div>
                            {event.markets && event.markets.length > 1 && (
                              <div className={styles.resultMeta}>{event.markets.length} markets</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.selectedEvent}>
                  {selectedEvent.image && <img src={selectedEvent.image} alt="" />}
                  <div>
                    <div className={styles.selectedEventTitle}>{selectedEvent.title}</div>
                    <button
                      type="button"
                      className={styles.changeButton}
                      onClick={() => setSelectedEvent(null)}
                    >
                      Change
                    </button>
                  </div>
                </div>
              )}

              {/* Market selection for multi-market events */}
              {selectedEvent && selectedEvent.markets && selectedEvent.markets.length > 1 && (
                <select
                  className={styles.select}
                  value={selectedMarket}
                  onChange={(e) => setSelectedMarket(e.target.value)}
                  required
                >
                  <option value="">Select a market</option>
                  {selectedEvent.markets.map((market, idx) => (
                    <option key={idx} value={market.question}>
                      {market.question}
                    </option>
                  ))}
                </select>
              )}

              {selectedEvent && selectedEvent.markets && selectedEvent.markets.length === 1 && !selectedMarket && (
                <>
                  {setSelectedMarket(selectedEvent.markets[0].question)}
                </>
              )}
            </div>
          )}

          {/* Trade Details */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>📊 Trade Details</label>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>Position *</label>
                <div className={styles.positionButtons}>
                  <button
                    type="button"
                    className={`${styles.positionButton} ${styles.yesButton} ${formData.position === 'yes' ? styles.active : ''}`}
                    onClick={() => setFormData({ ...formData, position: 'yes' })}
                  >
                    YES
                  </button>
                  <button
                    type="button"
                    className={`${styles.positionButton} ${styles.noButton} ${formData.position === 'no' ? styles.active : ''}`}
                    onClick={() => setFormData({ ...formData, position: 'no' })}
                  >
                    NO
                  </button>
                </div>
              </div>

              <div className={styles.field}>
                <label>Entry Price (0-1) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  className={styles.input}
                  value={formData.entryPrice}
                  onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                  required
                  placeholder="0.65"
                />
              </div>
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>Size ($) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={styles.input}
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  required
                  placeholder="100"
                />
              </div>

              <div className={styles.field}>
                <label>Entry Date *</label>
                <input
                  type="date"
                  className={styles.input}
                  value={formData.entryDate}
                  onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                  required
                />
              </div>

              <div className={styles.field}>
                <label>Confidence (1-10) *</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className={styles.input}
                  value={formData.confidence}
                  onChange={(e) => setFormData({ ...formData, confidence: e.target.value })}
                  required
                />
              </div>
            </div>
          </div>

          {/* Edge & Thesis */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>💡 Your Analysis</label>

            <div className={styles.field}>
              <label>Edge (What advantage do you have?) *</label>
              <textarea
                className={styles.textarea}
                rows={2}
                value={formData.edge}
                onChange={(e) => setFormData({ ...formData, edge: e.target.value })}
                placeholder="e.g., Market is overreacting to recent news, fundamentals haven't changed"
                required
              />
            </div>

            <div className={styles.field}>
              <label>Thesis (Why this trade?) *</label>
              <textarea
                className={styles.textarea}
                rows={3}
                value={formData.thesis}
                onChange={(e) => setFormData({ ...formData, thesis: e.target.value })}
                placeholder="Detailed explanation of your reasoning..."
                required
              />
            </div>

            <div className={styles.field}>
              <label>Reasoning & Research</label>
              <textarea
                className={styles.textarea}
                rows={4}
                value={formData.reasoning}
                onChange={(e) => setFormData({ ...formData, reasoning: e.target.value })}
                placeholder="Supporting data, research, sources..."
              />
            </div>
          </div>

          {/* Trade Status */}
          <div className={styles.section}>
            <label className={styles.sectionLabel}>📌 Status</label>

            <div className={styles.field}>
              <label>Trade Status</label>
              <select
                className={styles.select}
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as 'open' | 'closed' })}
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {formData.status === 'closed' && (
              <div className={styles.row}>
                <div className={styles.field}>
                  <label>Exit Price (0-1)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    className={styles.input}
                    value={formData.exitPrice}
                    onChange={(e) => setFormData({ ...formData, exitPrice: e.target.value })}
                    placeholder="0.75"
                  />
                </div>

                <div className={styles.field}>
                  <label>Exit Date</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={formData.exitDate}
                    onChange={(e) => setFormData({ ...formData, exitDate: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className={styles.field}>
              <label>Tags (comma separated)</label>
              <input
                type="text"
                className={styles.input}
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="politics, sports, earnings"
              />
            </div>

            <div className={styles.field}>
              <label>Notes</label>
              <textarea
                className={styles.textarea}
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelButton} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.submitButton}>
              {editingId ? 'Update Entry' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
