import { test, expect } from '@playwright/test';
import { startGame } from './helpers/startGame.js';
import { collectCurrentStage, readState, useActivePortal } from './helpers/gameState.js';

test.describe('Full Game Completion', () => {
  test.setTimeout(600000);

  test('single player completes all 30 letters and reaches victory', async ({ page }) => {
    await startGame(page);

    let state = await readState(page);
    expect(state.mode).toBe('playing');
    expect(state.stageKey).toBe('sunCourt');

    while (state.mode !== 'victory') {
      const clearedState = await collectCurrentStage(page);

      expect(clearedState.stageKey).toBe(state.stageKey);

      await page.waitForFunction(
        () => {
          const s = JSON.parse(window.render_game_to_text());
          return s.portal && s.portal.targetStage;
        },
        null,
        { timeout: 30000 }
      );

      const portalState = await readState(page);
      expect(portalState.portal).toBeTruthy();
      expect(portalState.portal.targetStage).toBeTruthy();

      state = await useActivePortal(page);
    }

    const finalState = await readState(page);
    expect(finalState.mode).toBe('victory');
    expect(finalState.collectedCount).toBe(30);
    expect(finalState.totalCollectibles).toBe(30);

    const winScreenVisible = await page.evaluate(() => {
      const ws = document.getElementById('win-screen');
      return Boolean(ws && ws.classList.contains('is-visible'));
    });
    expect(winScreenVisible).toBe(true);

    const collectedLabel = await page.textContent('#collected-count');
    expect(collectedLabel).toBe('30 / 30');
  });
});
