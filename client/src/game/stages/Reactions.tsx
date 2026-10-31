import { FEATURES, FOMO, REACTION_QUESTION, SLIDERS } from '../../config/game';
import { useLog } from '../../lib/useLog';
import { useGame } from '../GameProvider';
import { nextStep, stepIndex } from '../steps';
import { GameShell } from '../ui/GameShell';
import { Panel, Title } from '../ui/kit';
import { ChoiceList, Scale7 } from '../ui/questions';

/**
 * S13 — Quick reactions, one per screen: a yes/no card for each feature the player saw (in their
 * own skin), then trust and urgency (1–7), then three FOMO statements (agree / disagree).
 */
export function Reactions() {
  const { game, skin, dispatch, respond, go } = useGame();
  const step = game.step;
  useLog(step);
  const i = stepIndex(step);
  const fraud = skin === 'fraud';

  function answer(id: string, value: string | number) {
    dispatch({ type: 'answer', id, value });
    respond(id, value);
    go(nextStep(step));
  }

  const nF = FEATURES.length;
  const nS = SLIDERS.length;
  let body;
  if (i < nF) {
    const f = FEATURES[i];
    const id = `feature_push_${f.id}`;
    body = (
      <>
        <Panel skin={skin} className="text-center" glow={fraud}>
          <div className={`text-xs ${fraud ? 'text-white/50' : 'text-slate-500'}`}>
            You saw this
          </div>
          <div className={fraud ? 'mt-1 text-xl font-black' : 'mt-1 text-lg font-semibold'}>
            {f.label[skin]}
          </div>
          <div className={`mt-2 text-sm ${fraud ? 'text-gold-300' : 'text-slate-600'}`}>
            {f.hint[skin]}
          </div>
        </Panel>
        <div className="mt-4">
          <Title skin={skin}>{REACTION_QUESTION}</Title>
          <ChoiceList
            skin={skin}
            label={REACTION_QUESTION}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
            value={game.answers[id]}
            onPick={(v) => answer(id, v)}
          />
        </div>
      </>
    );
  } else if (i < nF + nS) {
    const q = SLIDERS[i - nF];
    body = (
      <>
        <Title skin={skin}>{q.text}</Title>
        <Scale7
          skin={skin}
          label={q.text}
          value={
            typeof game.answers[q.id] === 'number' ? (game.answers[q.id] as number) : undefined
          }
          minLabel={q.minLabel}
          maxLabel={q.maxLabel}
          onPick={(v) => answer(q.id, v)}
        />
      </>
    );
  } else {
    const q = FOMO[i - nF - nS];
    body = (
      <>
        <Title skin={skin}>{q.text}</Title>
        <ChoiceList
          skin={skin}
          label={q.text}
          options={q.options}
          value={game.answers[q.id]}
          onPick={(v) => answer(q.id, v)}
        />
      </>
    );
  }

  return (
    <GameShell market={false}>
      <div
        className={`mb-3 text-xs font-bold tracking-widest uppercase ${fraud ? 'text-gold-300' : 'text-slate-500'}`}
      >
        Quick reactions · {i + 1}/{nF + nS + FOMO.length}
      </div>
      {body}
    </GameShell>
  );
}
