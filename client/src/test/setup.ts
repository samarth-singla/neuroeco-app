import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// jsdom does not implement scrolling
window.scrollTo = () => {};

// The game is the default flow. Tests of the original survey flow run with ?game=0;
// game tests switch to ?game=1 themselves.
window.history.replaceState({}, '', '/?game=0');
