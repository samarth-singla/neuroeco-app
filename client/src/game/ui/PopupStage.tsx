import type { ReactNode } from 'react';
import { ECONOMY } from '../../config/game';
import { useGame } from '../GameProvider';
import { upcomingRound } from '../steps';
import { LiveChart } from './Chart';
import { GameShell } from './GameShell';
import { Modal } from './kit';

/**
 * A pop-up step (bonus spin, bonus question): the trading screen stays visible but inert behind
 * the pop-up, so the mini-game feels like part of the app rather than a separate page.
 */
export function PopupStage({
  label,
  children,
  actions,
}: {
  label: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const { game, skin } = useGame();
  const fraud = skin === 'fraud';
  const round = upcomingRound(game.step);
  return (
    <>
      <GameShell inert>
        <div className="mb-2 flex items-center justify-between">
          <div className={fraud ? 'text-xl font-black' : 'text-lg font-bold'}>
            {round ? (
              <>
                Round {round}{' '}
                <span className={fraud ? 'text-white/40' : 'text-slate-400'}>
                  / {ECONOMY.rounds.count}
                </span>
              </>
            ) : (
              'Next: special offers'
            )}
          </div>
        </div>
        <div
          className={
            fraud
              ? 'rounded-2xl bg-black/40 p-2'
              : 'rounded-xl border border-slate-700 bg-slate-800 p-2'
          }
        >
          <LiveChart
            skin={skin}
            rate={0.05}
            seed={(round ?? 5) * 17}
            ms={0}
            running={false}
            height={120}
          />
        </div>
      </GameShell>
      <Modal skin={skin} label={label} actions={actions}>
        {children}
      </Modal>
    </>
  );
}
