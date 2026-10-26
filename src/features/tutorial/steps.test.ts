import { describe, expect, it } from 'vitest';
import { tutorialSteps, type TutorialState } from './steps';

const state = (patch: Partial<TutorialState> = {}): TutorialState => ({
  expression: '',
  result: null,
  tool: 'basic',
  explored: false,
  ...patch,
});

describe('primeros pasos', () => {
  it('cada paso se cumple haciendo la acción, no antes', () => {
    const [first, fraction, keypad, menu, explore, last] = tutorialSteps;
    expect(first.done(state())).toBe(false);
    expect(first.done(state({ result: '5' }))).toBe(true);
    expect(fraction.done(state({ result: '5' }))).toBe(false);
    expect(fraction.done(state({ result: '1/2' }))).toBe(true);
    expect(keypad.done(state({ expression: 'sqrt( )' }))).toBe(true);
    expect(keypad.done(state({ expression: '2+3' }))).toBe(false);
    expect(menu.done(state({ tool: 'table' }))).toBe(true);
    expect(explore.done(state({ explored: true }))).toBe(true);
    // El último solo termina cuando la persona lo decide.
    expect(last.done(state({ result: '5', tool: 'table', explored: true }))).toBe(false);
  });
  it('cada paso dice qué hacer y, salvo el último, qué se logró', () => {
    for (const [i, step] of tutorialSteps.entries()) {
      expect(step.text.length, step.title).toBeGreaterThan(40);
      if (i < tutorialSteps.length - 1) expect(step.success.length, step.title).toBeGreaterThan(10);
    }
  });
});
