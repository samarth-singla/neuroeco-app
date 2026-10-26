import { fireEvent, screen, within } from '@testing-library/react';
import type { Item, Page } from '../config/survey';

/** A valid answer for any item (used by the flow tests). */
export function validAnswer(item: Item): string | number | null {
  switch (item.type) {
    case 'likert':
      return 4;
    case 'choice':
      return item.options[0].value;
    case 'number':
      return item.min + 1;
    case 'slider':
      return item.max / 2;
    case 'text':
      return null;
  }
}

/** Fills in every item of the page on screen with a valid answer. */
export function answerPageItems(page: Page) {
  for (const item of page.items) {
    const box = document.querySelector<HTMLElement>(`[data-item="${item.id}"]`);
    if (!box) throw new Error(`item ${item.id} not on screen`);
    const scope = within(box);
    switch (item.type) {
      case 'likert':
        fireEvent.click(scope.getByRole('radio', { name: '4' }));
        break;
      case 'choice':
        fireEvent.click(scope.getByRole('radio', { name: item.options[0].label }));
        break;
      case 'number':
        fireEvent.change(scope.getByRole('textbox'), {
          target: { value: String(validAnswer(item)) },
        });
        break;
      case 'slider':
        fireEvent.change(scope.getByRole('slider'), { target: { value: String(item.max / 2) } });
        break;
      case 'text':
        break;
    }
  }
}

export function clickNext() {
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}
