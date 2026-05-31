import { test, expect } from '@playwright/test';
import { startGame } from './helpers/startGame.js';
import { collectCurrentStage, readState, useActivePortal } from './helpers/gameState.js';

test.describe('Portal Transition Tests', () => {
  test.setTimeout(180000);

  test('should transition from Sun Court to Halloween Hallows after collecting all stage letters', async ({ page }) => {
    await startGame(page);

    const clearedState = await collectCurrentStage(page);
    expect(clearedState.stageKey).toBe('sunCourt');
    expect(clearedState.portal?.targetStage).toBe('halloweenHollows');

    const transitionedState = await useActivePortal(page);
    expect(transitionedState.stageKey).toBe('halloweenHollows');
    expect(transitionedState.currentMap).toBe('halloweenHollows');
    expect(transitionedState.alphabet.currentStageLetterIds).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  });

  test('should transition from Halloween Hallows to Hexagon Village after collecting all stage letters', async ({ page }) => {
    await startGame(page);

    await collectCurrentStage(page);
    await useActivePortal(page);

    const secondStageCleared = await collectCurrentStage(page);
    expect(secondStageCleared.stageKey).toBe('halloweenHollows');
    expect(secondStageCleared.portal?.targetStage).toBe('hexagonVillage');

    const transitionedState = await useActivePortal(page);
    expect(transitionedState.stageKey).toBe('hexagonVillage');
    expect(transitionedState.currentMap).toBe('hexagonVillage');
    expect(transitionedState.alphabet.currentStageLetterIds).toEqual([21, 22, 23, 24, 25, 26, 27, 28, 29, 30]);
  });

  test('should display correct stage metadata across portal transitions', async ({ page }) => {
    await startGame(page);

    const initialState = await readState(page);
    expect(initialState.stageKey).toBe('sunCourt');
    expect(initialState.zone).toBe('Sun Court');
    expect(initialState.phase).toBe(1);

    await collectCurrentStage(page);
    const halloweenState = await useActivePortal(page);
    expect(halloweenState.stageKey).toBe('halloweenHollows');
    expect(halloweenState.zone).toBe('Avlu');
    expect(halloweenState.phase).toBe(2);

    await collectCurrentStage(page);
    const hexagonState = await useActivePortal(page);
    expect(hexagonState.stageKey).toBe('hexagonVillage');
    expect(hexagonState.zone).toBe('Market Meydani');
    expect(hexagonState.phase).toBe(3);
  });
});
