import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { portfolioService } from '@/lib/portfolioService';

export default function DebugPosition() {
  const { userId } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    async function fetchData() {
      try {
        if (!userId) return;
        const portfolio = await portfolioService.getOrCreatePortfolio(userId);

        // Find Heat vs Pacers position
        const heatPacersPosition = portfolio?.positions.find((p: any) =>
          p.marketQuestion?.toLowerCase().includes('heat') &&
          p.marketQuestion?.toLowerCase().includes('pacers')
        );

        if (!heatPacersPosition) {
          setError('Heat vs Pacers position not found');
          setLoading(false);
          return;
        }

        // Find related trades
        const relatedTrades = (portfolio?.trades || []).filter((t: any) =>
          t.marketId === heatPacersPosition.marketId &&
          t.side === heatPacersPosition.side
        );

        const buyTrades = relatedTrades.filter((t: any) => t.action === 'BUY');
        const sellTrades = relatedTrades.filter((t: any) => t.action === 'SELL');

        // Calculate totals
        const totalBoughtShares = buyTrades.reduce((sum: number, t: any) => sum + t.shares, 0);
        const totalBoughtValue = buyTrades.reduce((sum: number, t: any) => sum + t.total, 0);
        const totalSoldShares = sellTrades.reduce((sum: number, t: any) => sum + t.shares, 0);
        const totalSoldValue = sellTrades.reduce((sum: number, t: any) => sum + t.total, 0);

        setData({
          position: heatPacersPosition,
          buyTrades,
          sellTrades,
          totals: {
            totalBoughtShares,
            totalBoughtValue,
            totalSoldShares,
            totalSoldValue,
            avgBuyPrice: totalBoughtValue / totalBoughtShares,
            avgSellPrice: totalSoldValue / totalSoldShares,
            netShares: totalBoughtShares - totalSoldShares,
            realizedPnL: totalSoldValue - totalBoughtValue,
            realizedPnLPercent: ((totalSoldValue - totalBoughtValue) / totalBoughtValue) * 100,
          }
        });
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    }

    fetchData();
  }, [userId]);

  if (!userId) {
    return <div style={{ padding: '20px' }}>Please log in first</div>;
  }

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  }

  const { position, buyTrades, sellTrades, totals } = data;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '1200px' }}>
      <h1>🔍 Heat vs Pacers Position Debug</h1>

      <div style={{ marginBottom: '30px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h2>📊 Position Data</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td><strong>ID:</strong></td><td>{position.id}</td></tr>
            <tr><td><strong>Market:</strong></td><td>{position.marketQuestion}</td></tr>
            <tr><td><strong>Side:</strong></td><td>{position.side}</td></tr>
            <tr><td><strong>Status:</strong></td><td style={{ color: position.closed ? 'green' : 'red' }}>{position.closed ? 'CLOSED' : 'OPEN'}</td></tr>
            <tr><td><strong>Shares:</strong></td><td>{position.shares}</td></tr>
            <tr><td><strong>Avg Price:</strong></td><td>${position.avgPrice?.toFixed(3)}</td></tr>
            <tr><td><strong>Cost:</strong></td><td>${position.cost?.toFixed(2)}</td></tr>
            <tr><td><strong>PnL:</strong></td><td style={{ color: position.pnl >= 0 ? 'green' : 'red' }}>${position.pnl?.toFixed(2)} ({position.pnlPercent?.toFixed(2)}%)</td></tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginBottom: '30px', padding: '15px', background: '#e8f5e9', borderRadius: '8px' }}>
        <h2>🟢 Buy Trades ({buyTrades.length})</h2>
        {buyTrades.map((t: any, i: number) => (
          <div key={i} style={{ marginBottom: '10px', padding: '10px', background: 'white', borderRadius: '4px' }}>
            <div><strong>#{i + 1}</strong> {new Date(t.timestamp).toLocaleString()}</div>
            <div>Shares: {t.shares.toFixed(2)} @ ${t.price.toFixed(3)} = ${t.total.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '30px', padding: '15px', background: '#ffebee', borderRadius: '8px' }}>
        <h2>🔴 Sell Trades ({sellTrades.length})</h2>
        {sellTrades.map((t: any, i: number) => (
          <div key={i} style={{ marginBottom: '10px', padding: '10px', background: 'white', borderRadius: '4px' }}>
            <div><strong>#{i + 1}</strong> {new Date(t.timestamp).toLocaleString()}</div>
            <div>Shares: {t.shares.toFixed(2)} @ ${t.price.toFixed(3)} = ${t.total.toFixed(2)}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: '15px', background: '#fff3e0', borderRadius: '8px' }}>
        <h2>📈 Calculated Totals</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr><td><strong>Total Bought:</strong></td><td>{totals.totalBoughtShares.toFixed(2)} shares for ${totals.totalBoughtValue.toFixed(2)}</td></tr>
            <tr><td><strong>Avg Buy Price:</strong></td><td>${totals.avgBuyPrice.toFixed(3)}</td></tr>
            <tr><td><strong>Total Sold:</strong></td><td>{totals.totalSoldShares.toFixed(2)} shares for ${totals.totalSoldValue.toFixed(2)}</td></tr>
            <tr><td><strong>Avg Sell Price:</strong></td><td>${totals.avgSellPrice.toFixed(3)}</td></tr>
            <tr><td><strong>Net Shares:</strong></td><td style={{ color: totals.netShares <= 0.1 ? 'green' : 'red' }}>{totals.netShares.toFixed(2)}</td></tr>
            <tr><td><strong>Realized P&L:</strong></td><td style={{ color: totals.realizedPnL >= 0 ? 'green' : 'red' }}>${totals.realizedPnL.toFixed(2)} ({totals.realizedPnLPercent.toFixed(2)}%)</td></tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '30px', padding: '15px', background: '#e3f2fd', borderRadius: '8px' }}>
        <h3>🔧 Fix Position</h3>
        <button
          onClick={async () => {
            const confirmed = confirm(`Close position with:\n- ${sellTrades.length} sells\n- Avg Exit Price: $${totals.avgSellPrice.toFixed(3)}\n- P&L: $${totals.realizedPnL.toFixed(2)} (${totals.realizedPnLPercent.toFixed(2)}%)`);
            if (!confirmed) return;

            try {
              const response = await fetch('/api/fix-position', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  userId,
                  positionId: position.id,
                  action: 'close',
                  originalShares: totals.totalBoughtShares,
                  totalSoldShares: totals.totalSoldShares,
                  totalSoldValue: totals.totalSoldValue,
                }),
              });
              const result = await response.json();
              alert(result.message);
              window.location.reload();
            } catch (err: any) {
              alert('Error: ' + err.message);
            }
          }}
          style={{
            padding: '10px 20px',
            background: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          Close This Position
        </button>
      </div>
    </div>
  );
}
