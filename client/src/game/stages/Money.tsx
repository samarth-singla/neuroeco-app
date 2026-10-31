import { useEffect, useState } from 'react';
import { CHAT, ECONOMY, TIMING } from '../../config/game';
import { useDecisionTimer, useLog } from '../../lib/useLog';
import { formatINR, taxFor, vipLevel, withdrawable } from '../economy';
import { useGame } from '../GameProvider';
import { nextStep } from '../steps';
import { GameShell } from '../ui/GameShell';
import {
  AmountPicker,
  Celebrate,
  Countdown,
  CtaButton,
  Money,
  Panel,
  SkipButton,
  Title,
  validAmount,
} from '../ui/kit';
import { play } from '../ui/sound';

/**
 * S9 — Test withdrawal (H6). `allowed`: withdraw ₹500 with a success animation. `not_offered`:
 * withdrawals are closed. Then a deposit offer (the H6 DV), capped at ₹5,000.
 */
export function Withdraw() {
  const { game, assignment, skin, dispatch, go } = useGame();
  const step = game.step;
  useLog(step);
  const fraud = skin === 'fraud';
  const allowed = assignment.withdrawal_offer === 'allowed';
  const [processing, setProcessing] = useState(false);
  const [amount, setAmount] = useState(0);
  const max = Math.min(game.wallets.main, ECONOMY.postWithdrawalMax);

  useEffect(() => {
    if (!allowed) dispatch({ type: 'withdraw_unavailable' });
  }, [allowed, dispatch]);

  useEffect(() => {
    if (!processing) return;
    const id = setTimeout(() => {
      dispatch({ type: 'withdraw_test', take: true });
      setProcessing(false);
    }, 1500);
    return () => clearTimeout(id);
  }, [processing, dispatch]);

  const phase = game.withdrawTest === undefined ? 'withdraw' : 'deposit';

  function deposit(value: number) {
    dispatch({ type: 's9_deposit', amount: value, at: Date.now() });
    go(nextStep(step));
  }

  let actions;
  if (phase === 'withdraw' && allowed) {
    actions = (
      <>
        <CtaButton skin={skin} disabled={processing} onClick={() => setProcessing(true)}>
          {processing ? 'Processing…' : `Withdraw ${formatINR(ECONOMY.testWithdrawal)}`}
        </CtaButton>
        <SkipButton
          skin={skin}
          disabled={processing}
          onClick={() => dispatch({ type: 'withdraw_test', take: false })}
        >
          Not now
        </SkipButton>
      </>
    );
  } else if (phase === 'deposit') {
    actions = (
      <>
        <CtaButton skin={skin} disabled={!validAmount(amount, max)} onClick={() => deposit(amount)}>
          {fraud
            ? `DEPOSIT ${amount ? formatINR(amount) : ''} 🚀`
            : `Deposit ${amount ? formatINR(amount) : ''}`}
        </CtaButton>
        <SkipButton skin={skin} onClick={() => deposit(0)}>
          Not now
        </SkipButton>
      </>
    );
  }

  return (
    <GameShell actions={actions}>
      {game.withdrawTest === 'done' && <Celebrate skin={skin} big />}
      <Title skin={skin}>{allowed ? 'Try a withdrawal' : 'Withdrawals'}</Title>

      {allowed ? (
        <Panel skin={skin} glow={fraud && game.withdrawTest === 'done'}>
          {game.withdrawTest === 'done' ? (
            <div className="text-center" data-testid="withdraw-success">
              <div className={fraud ? 'animate-pop text-5xl' : 'text-3xl'}>✅</div>
              <div
                className={fraud ? 'neon-text mt-1 text-3xl font-black' : 'mt-1 text-xl font-bold'}
              >
                {fraud ? 'Money sent!' : 'Withdrawal processed'}
              </div>
              <div className={fraud ? 'text-sm text-white/70' : 'text-sm text-slate-600'}>
                {formatINR(ECONOMY.testWithdrawal)} is on its way to your bank account (simulated).
              </div>
            </div>
          ) : game.withdrawTest === 'skipped' ? (
            <div className={fraud ? 'text-white/70' : 'text-slate-600'}>No withdrawal made.</div>
          ) : (
            <div className={fraud ? 'text-white/80' : 'text-slate-700'}>
              Withdraw {formatINR(ECONOMY.testWithdrawal)} from your Main wallet to your bank
              (simulated).
            </div>
          )}
        </Panel>
      ) : (
        <Panel skin={skin}>
          <div className={fraud ? 'text-lg font-black text-gold-300' : 'font-semibold'}>
            {fraud
              ? // DECISION: name the VIP level above the player's own, so the lock always reads "not yet"
                `🔒 Withdrawals open at VIP ${Math.max(ECONOMY.vipUpgradeLevel, vipLevel(game.totalDeposited) + 1)}`
              : 'Withdrawals are not available at this stage.'}
          </div>
        </Panel>
      )}

      {phase === 'deposit' && (
        <div className="mt-4 space-y-3">
          <div className={fraud ? 'text-lg font-black' : 'font-semibold'}>
            {fraud ? 'Keep growing — add to your Portfolio 💰' : 'Add money to your Portfolio?'}
          </div>
          <AmountPicker
            skin={skin}
            max={game.wallets.main}
            limit={ECONOMY.postWithdrawalMax}
            value={amount}
            onChange={setAmount}
            label={`Deposit (up to ${formatINR(ECONOMY.postWithdrawalMax)})`}
          />
          {!fraud && (
            <p className="text-xs text-slate-600">
              Portfolio money stays locked until you cash out.
            </p>
          )}
        </div>
      )}
    </GameShell>
  );
}

/** S10 — Gold Plan reinvest offer (H7): ₹2,000 from Profit wallet vs from Main wallet. */
export function Reinvest() {
  const { game, assignment, skin, dispatch, go } = useGame();
  const step = game.step;
  useLog(step);
  const fraud = skin === 'fraud';
  const fromProfit = assignment.money_source === 'profit';
  const sourceBalance = fromProfit ? game.wallets.profit : game.wallets.main;
  const max = Math.min(ECONOMY.reinvest.amount, sourceBalance);
  const [amount, setAmount] = useState(
    ECONOMY.reinvest.amount <= sourceBalance ? ECONOMY.reinvest.amount : 0,
  );

  function finish(value: number) {
    dispatch({ type: 'reinvest', amount: value, at: Date.now() });
    go(nextStep(step));
  }

  const headline = fromProfit
    ? `Reinvest ${formatINR(ECONOMY.reinvest.amount)} from your profits`
    : `Add ${formatINR(ECONOMY.reinvest.amount)} from your main wallet`;

  return (
    <GameShell
      actions={
        <>
          <CtaButton
            skin={skin}
            disabled={amount < ECONOMY.minInvest}
            onClick={() => finish(amount)}
          >
            {fromProfit ? `Reinvest ${formatINR(amount)}` : `Add ${formatINR(amount)}`}
          </CtaButton>
          <SkipButton skin={skin} onClick={() => finish(0)}>
            No thanks
          </SkipButton>
        </>
      }
    >
      <Panel skin={skin} glow={fraud} className={fraud ? 'border-gold-400/50' : ''}>
        <div className={fraud ? 'gold-text text-3xl font-black' : 'text-lg font-semibold'}>
          🥇 Gold Plan
        </div>
        <div
          className={fraud ? 'mt-1 text-lg font-bold' : 'mt-1 text-base'}
          data-testid="reinvest-headline"
        >
          {headline}
        </div>
        <div className={`mt-1 text-sm ${fraud ? 'text-white/60' : 'text-slate-600'}`}>
          {fromProfit ? 'Profit wallet' : 'Main wallet'}: {formatINR(sourceBalance)}
        </div>
      </Panel>

      <div className="mt-5">
        <label
          htmlFor="reinvest"
          className={`text-sm ${fraud ? 'text-white/70' : 'text-slate-700'}`}
        >
          How much? <span className="tabular font-bold">{formatINR(amount)}</span>
        </label>
        <input
          id="reinvest"
          type="range"
          min={0}
          max={max}
          step={ECONOMY.reinvest.step}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className={`mt-2 w-full ${fraud ? 'accent-amber-400' : 'accent-slate-900'}`}
        />
        <div
          className={`flex justify-between text-xs ${fraud ? 'text-white/40' : 'text-slate-500'}`}
        >
          <span>₹0</span>
          <span>{formatINR(max)}</span>
        </div>
        {!fraud && (
          <p className="mt-3 text-xs text-slate-600">
            Gold Plan money stays locked until you cash out.
          </p>
        )}
      </div>
    </GameShell>
  );
}

/**
 * S11 — Market crash (H4): Main wallet and Portfolio drop 40%. Top up to "activate Loss Shield"
 * or leave it. Fraud adds a "recover in 10 minutes" countdown (resets, never blocks).
 */
export function Crash() {
  const { game, skin, dispatch, go } = useGame();
  const step = game.step;
  const log = useLog(step);
  const decide = useDecisionTimer();
  const fraud = skin === 'fraud';
  const [amount, setAmount] = useState(0);

  useEffect(() => {
    dispatch({ type: 'crash' });
    if (fraud) play('loss');
  }, [dispatch, fraud]);

  function finish(value: number) {
    const { decision_ms } = decide();
    dispatch({ type: 'topup', amount: value, at: Date.now(), decisionMs: decision_ms });
    go(nextStep(step));
  }

  return (
    <GameShell
      actions={
        <>
          <CtaButton
            skin={skin}
            disabled={!validAmount(amount, game.wallets.main)}
            onClick={() => finish(amount)}
          >
            {fraud
              ? `TOP UP ${amount ? formatINR(amount) : ''} 🛡️`
              : `Top up ${amount ? formatINR(amount) : ''}`}
          </CtaButton>
          <SkipButton skin={skin} onClick={() => finish(0)}>
            Leave it
          </SkipButton>
        </>
      }
    >
      <div
        className={`rounded-2xl py-3 text-center ${fraud ? 'animate-flash-red animate-shake' : ''}`}
      >
        <div
          className={
            fraud
              ? 'text-sm font-black tracking-widest text-red-400 uppercase'
              : 'text-sm font-semibold text-slate-500'
          }
        >
          {fraud ? '⚠️ Market correction' : 'Market correction'}
        </div>
        <div
          className={
            fraud ? 'mt-1 text-7xl font-black text-red-500' : 'mt-1 text-4xl font-bold text-red-700'
          }
        >
          −40%
        </div>
        <div className={fraud ? 'text-lg text-white/80' : 'text-base text-slate-700'}>
          You lost <span className="font-black">{formatINR(game.crashLoss ?? 0)}</span> from Main
          and Portfolio
        </div>
      </div>

      {fraud && (
        <div className="mt-4 rounded-2xl bg-red-500/15 px-3 py-2 text-center text-sm font-bold text-red-300">
          Recover in{' '}
          <Countdown
            seconds={TIMING.crashCountdownSec}
            resetLabel="Last chance…"
            onReset={() => log('timer_reset')}
          />{' '}
          or losses become permanent
        </div>
      )}

      <div className="mt-4 space-y-3">
        <div className={fraud ? 'font-black' : 'font-semibold'}>
          {fraud ? 'Top up to activate Loss Shield and recover 🛡️' : 'Top up your Portfolio?'}
        </div>
        <AmountPicker
          skin={skin}
          max={game.wallets.main}
          value={amount}
          onChange={setAmount}
          label="Top-up amount"
        />
        {!fraud && (
          <p className="text-xs text-slate-600">
            Adding money does not undo the loss. Prices can fall further.
          </p>
        )}
      </div>
    </GameShell>
  );
}

/**
 * S12 — Withdraw everything. Honest: processes. Fraud: blocked by a 10% "processing tax" (H1g),
 * with an account-freeze warning and a support message pushing payment.
 */
export function Cashout() {
  const { game, skin, dispatch, go } = useGame();
  const step = game.step;
  const log = useLog(step);
  const fraud = skin === 'fraud';
  const total = withdrawable(game.wallets);
  const tax = game.taxShown ?? taxFor(game.wallets);
  const blocked = game.taxShown !== undefined && !game.cashout;

  let actions;
  if (game.cashout) {
    actions = (
      <CtaButton skin={skin} onClick={() => go(nextStep(step))}>
        Continue →
      </CtaButton>
    );
  } else if (blocked) {
    actions = (
      <>
        <CtaButton skin={skin} onClick={() => dispatch({ type: 'tax', pay: true })}>
          PAY TAX {formatINR(tax)}
        </CtaButton>
        <SkipButton skin={skin} onClick={() => dispatch({ type: 'tax', pay: false })}>
          Don’t pay
        </SkipButton>
      </>
    );
  } else {
    actions = (
      <CtaButton skin={skin} onClick={() => dispatch({ type: 'cashout_click' })}>
        Withdraw everything {formatINR(total)}
      </CtaButton>
    );
  }

  return (
    <GameShell actions={actions}>
      {game.cashout === 'done' && <Celebrate skin={skin} big />}
      <Title skin={skin}>Cash out</Title>

      {!blocked && !game.cashout && (
        <Panel skin={skin}>
          <div className={fraud ? 'text-sm text-white/60' : 'text-sm text-slate-600'}>
            Available to withdraw
          </div>
          <Money
            value={total}
            className={fraud ? 'gold-text text-5xl font-black' : 'text-3xl font-bold'}
          />
          <div className={`mt-1 text-xs ${fraud ? 'text-white/50' : 'text-slate-500'}`}>
            Main + Profit + Portfolio
          </div>
        </Panel>
      )}

      {blocked && (
        <div className="space-y-3" data-testid="tax-block">
          <div className="animate-shake rounded-2xl border border-red-500/60 bg-red-500/15 p-3 text-center">
            <div className="text-sm font-black text-red-300">⚠️ ACCOUNT FREEZE WARNING</div>
            <div className="text-xs text-red-200">
              Your account will be frozen in{' '}
              <Countdown
                seconds={TIMING.freezeCountdownSec}
                resetLabel="any moment"
                onReset={() => log('timer_reset')}
              />
            </div>
          </div>
          <Panel skin={skin} className="border-gold-400/50">
            <div className="text-lg font-black text-gold-300">Withdrawal on hold</div>
            <p className="mt-1 text-sm text-white/80">
              Pay the one-time 10% processing tax to unlock your balance of {formatINR(total)}.
            </p>
            <div className="mt-3 rounded-xl bg-black/40 p-3 text-center">
              <div className="text-xs text-white/50">Processing tax (10%)</div>
              <div className="text-3xl font-black">{formatINR(tax)}</div>
            </div>
          </Panel>
          <div className="flex items-end gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-black">
              CS
            </span>
            <div className="animate-toast-in rounded-2xl rounded-bl-none bg-[#1f2c33] px-3 py-2 text-sm">
              <div className="text-[10px] font-bold text-sky-300">
                Support · {CHAT.agentName}’s team
              </div>
              Sir, this is a one-time government processing tax. Pay now to avoid permanent freeze
              🙏
            </div>
          </div>
        </div>
      )}

      {game.cashout === 'done' && (
        <Panel skin={skin} className="text-center">
          <div className="text-3xl">✅</div>
          <div className="text-xl font-bold">Withdrawal processed</div>
          <div className="text-sm text-slate-600">
            {formatINR(game.wallets.cashedOut)} sent to your bank (simulated).
          </div>
        </Panel>
      )}
      {game.cashout === 'tax_paid' && (
        <Panel skin={skin} className="text-center">
          <div className="text-3xl">⏳</div>
          <div className="text-lg font-black">Payment received</div>
          <div className="text-sm text-white/70">
            Your withdrawal is under review (24–72 hours).
          </div>
        </Panel>
      )}
      {game.cashout === 'tax_declined' && (
        <Panel skin={skin} className="text-center">
          <div className="text-3xl">🔒</div>
          <div className="text-lg font-black">Your balance remains frozen</div>
        </Panel>
      )}
    </GameShell>
  );
}
