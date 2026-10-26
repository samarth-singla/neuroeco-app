import { StrictMode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { useDecisionTimer, useLog } from './useLog';
import { _pendingEvents, _resetLogger } from './logger';

function Probe() {
  const log = useLog('A2');
  const decide = useDecisionTimer();
  return (
    <button type="button" onClick={() => log('invest_click', decide())}>
      go
    </button>
  );
}

afterEach(() => _resetLogger());

describe('useLog / useDecisionTimer', () => {
  it('logs one screen_view per mount, even in StrictMode', () => {
    render(
      <StrictMode>
        <Probe />
      </StrictMode>,
    );
    const views = _pendingEvents().filter((e) => e.event_type === 'screen_view');
    expect(views).toHaveLength(1);
    expect(views[0].screen).toBe('A2');
  });

  it('records decision time and marks only the first decision', () => {
    render(<Probe />);
    fireEvent.click(screen.getByText('go'));
    fireEvent.click(screen.getByText('go'));
    const clicks = _pendingEvents().filter((e) => e.event_type === 'invest_click');
    expect(clicks).toHaveLength(2);
    const [first, second] = clicks.map(
      (c) => c.payload as { decision_ms: number; first_decision: boolean },
    );
    expect(first.first_decision).toBe(true);
    expect(second.first_decision).toBe(false);
    expect(first.decision_ms).toBeGreaterThanOrEqual(0);
  });
});
