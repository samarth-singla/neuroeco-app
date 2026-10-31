import { useRef, useState } from 'react';
import { FEATURES, FOMO, REACTION_QUESTION, SLIDERS } from '../../config/game';
import { clientNow } from '../../lib/logger';
import { useLog } from '../../lib/useLog';
import { useGame } from '../GameProvider';
import { nextStep, stepIndex } from '../steps';
import { FeatureMini } from '../ui/FeatureMini';
import { GameShell } from '../ui/GameShell';
import { CtaButton, Title } from '../ui/kit';
import { Slider7, SwipeCard } from '../ui/SwipeCard';

export const REACTION_COUNT = FEATURES.length + SLIDERS.length + FOMO.length;

/**
 * S13 — Quick reactions (about 60 s), one per screen:
 * 7 swipe cards "Did this push you to invest?" — one per feature, shown as the player saw it;
 * a trust slider and an urgency slider (1–7); 3 FOMO statements as agree/disagree swipe cards.
 */
export function Reactions() {
  const { game, skin, dispatch, respond, go } = useGame();
  const step = game.step;
  const log = useLog(step);
  const i = stepIndex(step);
  const fraud = skin === 'fraud';
  const shownAt = useRef(clientNow());
  const nF = FEATURES.length;
  const nS = SLIDERS.length;

  function answer(id: string, value: string | number, method?: 'swipe' | 'tap') {
    dispatch({ type: 'answer', id, value, ms: Math.round(clientNow() - shownAt.current) });
    respond(id, value);
    if (method) log('reaction_method', { id, method });
    go(nextStep(step));
  }

  let body;
  if (i < nF) {
    const f = FEATURES[i];
    const id = `feature_push_${f.id}`;
    body = (
      <>
        <Title skin={skin}>{REACTION_QUESTION}</Title>
        <SwipeCard
          skin={skin}
          left={{ value: 'no', label: 'No' }}
          right={{ value: 'yes', label: 'Yes' }}
          onAnswer={(v, m) => answer(id, v, m)}
        >
          <div className={`mb-2 text-center text-xs ${fraud ? 'text-white/50' : 'text-slate-500'}`}>
            You saw: <b>{f.label[skin]}</b>
          </div>
          <FeatureMini id={f.id} skin={skin} total={game.totalDeposited} />
        </SwipeCard>
      </>
    );
  } else if (i < nF + nS) {
    const q = SLIDERS[i - nF];
    body = <SliderQuestion key={q.id} q={q} onDone={(v) => answer(q.id, v)} />;
  } else {
    const q = FOMO[i - nF - nS];
    body = (
      <>
        <Title skin={skin}>Agree or disagree?</Title>
        <SwipeCard
          skin={skin}
          left={{ value: 'disagree', label: 'Disagree' }}
          right={{ value: 'agree', label: 'Agree' }}
          onAnswer={(v, m) => answer(q.id, v, m)}
        >
          <p
            className={`py-6 text-center text-lg leading-snug ${fraud ? 'font-bold' : 'text-slate-900'}`}
          >
            “{q.text}”
          </p>
        </SwipeCard>
      </>
    );
  }

  return (
    <GameShell market={false}>
      <div
        className={`mb-3 text-xs font-bold tracking-widest uppercase ${fraud ? 'text-gold-300' : 'text-slate-500'}`}
      >
        Quick reactions · {i + 1}/{REACTION_COUNT}
      </div>
      {body}
    </GameShell>
  );
}

function SliderQuestion({
  q,
  onDone,
}: {
  q: (typeof SLIDERS)[number];
  onDone: (v: number) => void;
}) {
  const { skin } = useGame();
  const [v, setV] = useState<number | null>(null);
  return (
    <>
      <Title skin={skin}>{q.text}</Title>
      <Slider7
        skin={skin}
        id={q.id}
        value={v}
        onChange={setV}
        minLabel={q.minLabel}
        maxLabel={q.maxLabel}
      />
      <CtaButton
        skin={skin}
        className="mt-6"
        disabled={v === null}
        onClick={() => v !== null && onDone(v)}
      >
        Next
      </CtaButton>
    </>
  );
}
