import { test, expect } from '@playwright/test';
import { startGame } from './helpers/startGame.js';
import { collectCurrentStage, openNearestChest, readState, teleportStage, useActivePortal } from './helpers/gameState.js';

test.describe('Physics Interactions Tests', () => {
  test('should open nearby treasure chests and create loot bursts', async ({ page }) => {
    await startGame(page);
    const state = await teleportStage(page, 'hexagonVillage');

    expect(state.chests?.length ?? 0).toBeGreaterThan(0);
    const chest = state.chests[0];
    expect(chest.opened).toBe(false);

    const updatedState = await openNearestChest(page, chest);
    const openedChest = updatedState.chests.find((entry) => entry.id === chest.id);

    expect(openedChest?.opened).toBe(true);
    expect(updatedState.lootBursts?.length ?? 0).toBeGreaterThan(0);
  });

  test('should update stage and zone metadata when teleporting between maps', async ({ page }) => {
    await startGame(page);

    const state = await teleportStage(page, 'hexagonVillage');

    expect(state.stageKey).toBe('hexagonVillage');
    expect(state.currentMap).toBe('hexagonVillage');
    expect(state.zone).toBeTruthy();
  });

  test('should move the player with the debug position helper', async ({ page }) => {
    await startGame(page);

    await page.evaluate(({ x, z }) => window.debug_set_player_position(x, z), { x: 6, z: 20 });
    await page.waitForTimeout(300);

    const state = await readState(page);

    expect(Math.abs(state.player.x - 6)).toBeLessThan(0.5);
    expect(Math.abs(state.player.z - 20)).toBeLessThan(0.5);
  });

  test('should expose barrier health data for visible collectibles', async ({ page }) => {
    await startGame(page);
    const state = await teleportStage(page, 'hexagonVillage');

    expect(state.visibleCollectibles?.length ?? 0).toBeGreaterThan(0);

    for (const collectible of state.visibleCollectibles) {
      expect(collectible.barrierHp).toBeGreaterThanOrEqual(0);
      expect(collectible.barrierMaxHp).toBeGreaterThan(0);
    }
  });

  test('should reveal a stage portal after collecting the current stage letters', async ({ page }) => {
    await startGame(page);

    const state = await collectCurrentStage(page);

    expect(state.portal).toBeTruthy();
    expect(state.portal.targetStage).toBe('halloweenHollows');
    expect(state.alphabet.currentStageLetterIds.every((id) => state.alphabet.collectedLetterIds.includes(id))).toBe(true);
  });

  test('should auto-transition when the player enters an active portal', async ({ page }) => {
    await startGame(page);

    await collectCurrentStage(page);
    const transitionedState = await useActivePortal(page);

    expect(transitionedState.stageKey).toBe('halloweenHollows');
    expect(transitionedState.currentMap).toBe('halloweenHollows');
    expect(transitionedState.zone).toBeTruthy();
  });
});
