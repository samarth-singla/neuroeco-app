import { useEffect, useState } from 'react';
import { CHAT, TIMING } from '../../config/game';
import { useLog } from '../../lib/useLog';
import { useGame } from '../GameProvider';
import { nextStep } from '../steps';
import { GameShell } from '../ui/GameShell';
import { CtaButton, Panel, SecondaryButton } from '../ui/kit';
import { play } from '../ui/sound';

/** Messages appear one by one with a typing indicator (fraud skin). */
function ChatThread() {
  const [shown, setShown] = useState(1);
  const typing = shown < CHAT.messages.length;
  useEffect(() => {
    if (!typing) return;
    const id = setTimeout(() => {
      setShown((n) => n + 1);
      play('tap');
    }, TIMING.chatTypingMs);
    return () => clearTimeout(id);
  }, [shown, typing]);
  return (
    <div className="space-y-2" data-testid="chat-thread">
      {CHAT.messages.slice(0, shown).map((m) => (
        <div key={m} className="animate-toast-in flex items-end gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold-400 text-sm font-black text-black">
            R
          </span>
          <div className="rounded-2xl rounded-bl-none bg-[#1f2c33] px-3 py-2 text-sm">{m}</div>
        </div>
      ))}
      {typing && (
        <div className="flex items-center gap-1 pl-10 text-xl text-white/60" aria-label="typing">
          <span className="typing-dot">•</span>
          <span className="typing-dot" style={{ animationDelay: '0.2s' }}>
            •
          </span>
          <span className="typing-dot" style={{ animationDelay: '0.4s' }}>
            •
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * S6 — After round 4. Fraud: "Rohit Sir, Senior Advisor" messages you (H1f). Honest: a static
 * Help & FAQ card. A deposit within 60 s of this screen counts as a chat deposit.
 */
export function Chat() {
  const { game, skin, dispatch, go } = useGame();
  const step = game.step;
  useLog(step);
  const fraud = skin === 'fraud';
  const [open, setOpen] = useState(game.chatOpened);

  useEffect(() => {
    dispatch({ type: 'chat_shown', at: Date.now() });
  }, [dispatch]);

  function openChat() {
    setOpen(true);
    dispatch({ type: 'chat_open' });
  }

  const actions = (
    <>
      {!open && (
        <CtaButton skin={skin} onClick={openChat}>
          {fraud ? 'Open chat 💬' : 'Open Help & FAQ'}
        </CtaButton>
      )}
      <SecondaryButton skin={skin} onClick={() => go(nextStep(step))}>
        {open ? 'Continue to round 5 →' : fraud ? 'Later' : 'Continue'}
      </SecondaryButton>
    </>
  );

  return (
    <GameShell actions={actions}>
      {fraud ? (
        <div className="rounded-2xl border border-white/10 bg-[#0b141a]">
          <div className="flex items-center gap-3 border-b border-white/10 px-3 py-2">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gold-400 text-lg font-black text-black">
              R
              <span className="absolute right-0 bottom-0 h-3 w-3 rounded-full border-2 border-[#0b141a] bg-neon-400" />
            </span>
            <div>
              <div className="font-bold">
                {CHAT.agentName} <span className="text-neon-400">✓</span>
              </div>
              <div className="text-[11px] text-white/50">{CHAT.agentRole} · online</div>
            </div>
          </div>
          <div className="min-h-56 p-3">
            {open ? (
              <ChatThread />
            ) : (
              <div className="animate-toast-in rounded-2xl bg-white/5 p-3">
                <div className="text-xs font-bold text-gold-300">🔔 {CHAT.notice}</div>
                <div className="mt-1 text-sm text-white/80">“{CHAT.messages[1]}”</div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <Panel skin={skin}>
          <div className="font-semibold">{CHAT.help.notice}</div>
          {open ? (
            <dl className="mt-3 space-y-3 text-sm" data-testid="help-faq">
              {CHAT.help.items.map((f) => (
                <div key={f.q}>
                  <dt className="font-semibold">{f.q}</dt>
                  <dd className="text-slate-600">{f.a}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-1 text-sm text-slate-600">
              Questions before the next rounds? Open Help & FAQ.
            </p>
          )}
        </Panel>
      )}
    </GameShell>
  );
}
