import React, { useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { PaperAccountState, TickerData } from '../types/trading';
import { fmtPrice } from '../utils/binance';

interface TradeDrawerProps {
  open: boolean;
  onClose: () => void;
  currentSymbol: string;
  currentPrice: number;
  tickerMap: Record<string, TickerData>;
  account: PaperAccountState;
  onPlaceOrder: (params: {
    side: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT';
    qty: number;
    limitPrice?: number;
    takeProfit?: number;
    stopLoss?: number;
  }) => void;
  onClosePosition: (id: string) => void;
  onCancelLimitOrder: (id: string) => void;
  onResetAccount: () => void;
}

export const TradeDrawer: React.FC<TradeDrawerProps> = ({
  open,
  onClose,
  currentSymbol,
  currentPrice,
  tickerMap,
  account,
  onPlaceOrder,
  onClosePosition,
  onCancelLimitOrder,
  onResetAccount,
}) => {
  const [tab, setTab] = useState<'positions' | 'orders' | 'history'>('positions');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [qtyStr, setQtyStr] = useState('0.1');
  const [limitPriceStr, setLimitPriceStr] = useState('');
  const [tpStr, setTpStr] = useState('');
  const [slStr, setSlStr] = useState('');

  if (!open) return null;

  const unrealizedTotal = account.positions.reduce((acc, p) => {
    const mark =
      tickerMap[p.symbol]?.last || (p.symbol === currentSymbol ? currentPrice : p.entryPrice);
    const pnl = (p.side === 'BUY' ? mark - p.entryPrice : p.entryPrice - mark) * p.qty;
    return acc + pnl;
  }, 0);

  const equity = account.balance + unrealizedTotal;

  const applyPctSizing = (pct: number) => {
    if (!currentPrice || currentPrice <= 0) return;
    const notional = account.balance * pct;
    const qty = notional / currentPrice;
    const decimals = currentPrice >= 1000 ? 4 : currentPrice >= 10 ? 3 : 1;
    setQtyStr(qty.toFixed(decimals));
  };

  const submit = (side: 'BUY' | 'SELL') => {
    const qty = parseFloat(qtyStr);
    if (!qty || qty <= 0) return;
    const limitPrice = orderType === 'LIMIT' ? parseFloat(limitPriceStr) : undefined;
    if (orderType === 'LIMIT' && (!limitPrice || limitPrice <= 0)) return;
    const takeProfit = parseFloat(tpStr) > 0 ? parseFloat(tpStr) : undefined;
    const stopLoss = parseFloat(slStr) > 0 ? parseFloat(slStr) : undefined;

    onPlaceOrder({ side, orderType, qty, limitPrice, takeProfit, stopLoss });
  };

  return (
    <section className="h-[245px] border-t border-[var(--border)] bg-[var(--bg-surface)] flex flex-col shrink-0 select-none">
      {/* Header & Order Controls */}
      <div className="min-h-[40px] border-b border-[var(--border)] px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-elevated)]">
        {/* Tabs + Account Metrics */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            {(
              [
                { id: 'positions', label: `Positions (${account.positions.length})` },
                { id: 'orders', label: `Open Orders (${account.limitOrders.length})` },
                { id: 'history', label: `History (${account.history.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-[var(--bg-active)] text-[var(--accent)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="hidden xl:flex items-center gap-3 text-[11px] font-mono-num text-[var(--text-muted)] border-l border-[var(--border)] pl-3">
            <span>
              Balance: <b className="text-[var(--text-main)]">${fmtPrice(account.balance, 2)}</b>
            </span>
            <span>
              Equity: <b className="text-[var(--text-main)]">${fmtPrice(equity, 2)}</b>
            </span>
            <span>
              Open P&L:{' '}
              <b className={unrealizedTotal >= 0 ? 'text-[var(--up)]' : 'text-[var(--down)]'}>
                {unrealizedTotal >= 0 ? '+' : ''}${unrealizedTotal.toFixed(2)}
              </b>
            </span>
            <span>
              Realized:{' '}
              <b className={account.realizedPnl >= 0 ? 'text-[var(--up)]' : 'text-[var(--down)]'}>
                {account.realizedPnl >= 0 ? '+' : ''}${account.realizedPnl.toFixed(2)}
              </b>
            </span>
          </div>
        </div>

        {/* Right Quick Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onResetAccount}
            title="Reset Virtual Balance to $100,000"
            className="h-7 px-2 rounded border border-[var(--border)] text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] inline-flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
          <button
            onClick={onClose}
            title="Close Trading Panel"
            className="w-7 h-7 rounded hover:bg-[var(--bg-hover)] inline-flex items-center justify-center text-[var(--text-muted)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Order Ticket Strip */}
      <div className="px-3 py-2 border-b border-[var(--border)] flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center rounded border border-[var(--border)] overflow-hidden">
          <button
            onClick={() => setOrderType('MARKET')}
            className={`px-2.5 h-7 text-[11px] font-semibold cursor-pointer ${
              orderType === 'MARKET'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-app)] text-[var(--text-muted)]'
            }`}
          >
            Market
          </button>
          <button
            onClick={() => {
              setOrderType('LIMIT');
              if (!limitPriceStr && currentPrice > 0) setLimitPriceStr(String(currentPrice));
            }}
            className={`px-2.5 h-7 text-[11px] font-semibold cursor-pointer ${
              orderType === 'LIMIT'
                ? 'bg-[var(--accent)] text-white'
                : 'bg-[var(--bg-app)] text-[var(--text-muted)]'
            }`}
          >
            Limit
          </button>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[var(--text-muted)] text-[11px]">Qty</span>
          <input
            type="number"
            step="any"
            min="0"
            value={qtyStr}
            onChange={(e) => setQtyStr(e.target.value)}
            className="w-20 h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs outline-none focus:border-[var(--accent)]"
          />
          {[0.1, 0.25, 0.5].map((pct) => (
            <button
              key={pct}
              onClick={() => applyPctSizing(pct)}
              className="h-7 px-1.5 rounded border border-[var(--border)] text-[10px] font-mono-num text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] cursor-pointer"
            >
              {pct * 100}%
            </button>
          ))}
        </div>

        {orderType === 'LIMIT' && (
          <div className="flex items-center gap-1">
            <span className="text-[var(--text-muted)] text-[11px]">Price</span>
            <input
              type="number"
              step="any"
              value={limitPriceStr}
              onChange={(e) => setLimitPriceStr(e.target.value)}
              placeholder={fmtPrice(currentPrice)}
              className="w-24 h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs outline-none focus:border-[var(--accent)]"
            />
          </div>
        )}

        <div className="flex items-center gap-1">
          <span className="text-[var(--up)] text-[11px] font-medium">TP</span>
          <input
            type="number"
            step="any"
            value={tpStr}
            onChange={(e) => setTpStr(e.target.value)}
            placeholder="Optional"
            className="w-22 h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs outline-none focus:border-[var(--up)]"
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[var(--down)] text-[11px] font-medium">SL</span>
          <input
            type="number"
            step="any"
            value={slStr}
            onChange={(e) => setSlStr(e.target.value)}
            placeholder="Optional"
            className="w-22 h-7 px-2 rounded border border-[var(--border)] bg-[var(--bg-app)] text-[var(--text-main)] font-mono-num text-xs outline-none focus:border-[var(--down)]"
          />
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden md:inline font-mono-num text-[11px] text-[var(--text-muted)] mr-1">
            {currentSymbol} @ ${fmtPrice(currentPrice)}
          </span>
          <button
            onClick={() => submit('BUY')}
            className="h-7 px-3.5 rounded bg-[var(--up)] text-white font-semibold text-xs hover:opacity-90 cursor-pointer whitespace-nowrap"
          >
            Buy / Long
          </button>
          <button
            onClick={() => submit('SELL')}
            className="h-7 px-3.5 rounded bg-[var(--down)] text-white font-semibold text-xs hover:opacity-90 cursor-pointer whitespace-nowrap"
          >
            Sell / Short
          </button>
        </div>
      </div>

      {/* Tables Area */}
      <div className="flex-1 overflow-y-auto px-3 py-1">
        {tab === 'positions' && (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="text-[11px] text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="py-1.5 font-medium">Symbol</th>
                <th className="py-1.5 font-medium">Side</th>
                <th className="py-1.5 font-medium text-right">Qty</th>
                <th className="py-1.5 font-medium text-right">Entry</th>
                <th className="py-1.5 font-medium text-right">Mark</th>
                <th className="py-1.5 font-medium text-right">TP / SL</th>
                <th className="py-1.5 font-medium text-right">Unrealized P&L</th>
                <th className="py-1.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/50 font-mono-num">
              {account.positions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center font-sans text-[var(--text-muted)]">
                    No open paper positions. Place a Market or Limit order above.
                  </td>
                </tr>
              ) : (
                account.positions.map((pos) => {
                  const mark =
                    tickerMap[pos.symbol]?.last ||
                    (pos.symbol === currentSymbol ? currentPrice : pos.entryPrice);
                  const pnl =
                    (pos.side === 'BUY' ? mark - pos.entryPrice : pos.entryPrice - mark) * pos.qty;
                  const roePct =
                    pos.entryPrice > 0
                      ? ((pos.side === 'BUY' ? mark - pos.entryPrice : pos.entryPrice - mark) /
                          pos.entryPrice) *
                        100
                      : 0;
                  return (
                    <tr key={pos.id} className="hover:bg-[var(--bg-hover)]/50">
                      <td className="py-1.5 font-sans font-bold text-[var(--text-main)]">
                        {pos.symbol}
                      </td>
                      <td
                        className={`py-1.5 font-sans font-bold ${
                          pos.side === 'BUY' ? 'text-[var(--up)]' : 'text-[var(--down)]'
                        }`}
                      >
                        {pos.side === 'BUY' ? 'LONG' : 'SHORT'}
                      </td>
                      <td className="py-1.5 text-right">{pos.qty}</td>
                      <td className="py-1.5 text-right">{fmtPrice(pos.entryPrice)}</td>
                      <td className="py-1.5 text-right">{fmtPrice(mark)}</td>
                      <td className="py-1.5 text-right text-[11px] text-[var(--text-muted)]">
                        <span className="text-[var(--up)]">
                          {pos.takeProfit ? fmtPrice(pos.takeProfit) : '—'}
                        </span>
                        {' / '}
                        <span className="text-[var(--down)]">
                          {pos.stopLoss ? fmtPrice(pos.stopLoss) : '—'}
                        </span>
                      </td>
                      <td
                        className={`py-1.5 text-right font-bold ${
                          pnl >= 0 ? 'text-[var(--up)]' : 'text-[var(--down)]'
                        }`}
                      >
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({roePct >= 0 ? '+' : ''}
                        {roePct.toFixed(2)}%)
                      </td>
                      <td className="py-1.5 text-right">
                        <button
                          onClick={() => onClosePosition(pos.id)}
                          className="px-2.5 py-0.5 rounded border border-[var(--border)] font-sans text-[11px] font-semibold hover:bg-[var(--bg-hover)] cursor-pointer"
                        >
                          Close
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}

        {tab === 'orders' && (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="text-[11px] text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="py-1.5 font-medium">Symbol</th>
                <th className="py-1.5 font-medium">Side</th>
                <th className="py-1.5 font-medium text-right">Qty</th>
                <th className="py-1.5 font-medium text-right">Limit Price</th>
                <th className="py-1.5 font-medium text-right">TP / SL</th>
                <th className="py-1.5 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/50 font-mono-num">
              {account.limitOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center font-sans text-[var(--text-muted)]">
                    No pending limit orders. Switch order type to Limit above to queue an entry.
                  </td>
                </tr>
              ) : (
                account.limitOrders.map((ord) => (
                  <tr key={ord.id}>
                    <td className="py-1.5 font-sans font-bold text-[var(--text-main)]">
                      {ord.symbol}
                    </td>
                    <td
                      className={`py-1.5 font-sans font-bold ${
                        ord.side === 'BUY' ? 'text-[var(--up)]' : 'text-[var(--down)]'
                      }`}
                    >
                      {ord.side}
                    </td>
                    <td className="py-1.5 text-right">{ord.qty}</td>
                    <td className="py-1.5 text-right">{fmtPrice(ord.limitPrice)}</td>
                    <td className="py-1.5 text-right text-[11px] text-[var(--text-muted)]">
                      {ord.takeProfit ? fmtPrice(ord.takeProfit) : '—'} /{' '}
                      {ord.stopLoss ? fmtPrice(ord.stopLoss) : '—'}
                    </td>
                    <td className="py-1.5 text-right">
                      <button
                        onClick={() => onCancelLimitOrder(ord.id)}
                        className="px-2.5 py-0.5 rounded border border-[var(--border)] font-sans text-[11px] font-semibold hover:text-[var(--down)] hover:bg-[var(--bg-hover)] cursor-pointer"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {tab === 'history' && (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="text-[11px] text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="py-1.5 font-medium">Time</th>
                <th className="py-1.5 font-medium">Symbol</th>
                <th className="py-1.5 font-medium">Side</th>
                <th className="py-1.5 font-medium text-right">Qty</th>
                <th className="py-1.5 font-medium text-right">Entry → Exit</th>
                <th className="py-1.5 font-medium text-right">Reason</th>
                <th className="py-1.5 font-medium text-right">Realized P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/50 font-mono-num">
              {account.history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center font-sans text-[var(--text-muted)]">
                    No closed trades yet.
                  </td>
                </tr>
              ) : (
                account.history.map((h) => (
                  <tr key={h.id}>
                    <td className="py-1.5 text-[var(--text-muted)]">
                      {new Date(h.closedAt).toLocaleTimeString('en-GB')}
                    </td>
                    <td className="py-1.5 font-sans font-bold text-[var(--text-main)]">
                      {h.symbol}
                    </td>
                    <td
                      className={`py-1.5 font-sans font-bold ${
                        h.side === 'BUY' ? 'text-[var(--up)]' : 'text-[var(--down)]'
                      }`}
                    >
                      {h.side}
                    </td>
                    <td className="py-1.5 text-right">{h.qty}</td>
                    <td className="py-1.5 text-right">
                      {fmtPrice(h.entryPrice)} → {fmtPrice(h.exitPrice)}
                    </td>
                    <td className="py-1.5 text-right font-sans text-[11px] text-[var(--text-muted)]">
                      {h.reason}
                    </td>
                    <td
                      className={`py-1.5 text-right font-bold ${
                        h.pnl >= 0 ? 'text-[var(--up)]' : 'text-[var(--down)]'
                      }`}
                    >
                      {h.pnl >= 0 ? '+' : ''}${h.pnl.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};
