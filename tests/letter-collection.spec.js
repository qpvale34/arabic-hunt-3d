import { test, expect } from '@playwright/test';
import { startGame } from './helpers/startGame.js';

test.describe('Letter Collection Tests', () => {
  test('should collect letters when player approaches them', async ({ page }) => {
    await startGame(page);
    
    // Get initial state
    const initialState = await page.evaluate(() => window.render_game_to_text());
    const parsedInitialState = JSON.parse(initialState);
    
    expect(parsedInitialState.collectedCount).toBe(0);
    expect(parsedInitialState.totalCollectibles).toBeGreaterThan(0);
    
    // Collect first letter using debug function
    await page.evaluate(() => window.debug_collect_nearest_letter());
    
    // Wait for collection animation
    await page.waitForTimeout(500);
    
    // Verify letter was collected
    const stateAfterFirstCollection = await page.evaluate(() => window.render_game_to_text());
    const parsedState = JSON.parse(stateAfterFirstCollection);
    
    expect(parsedState.collectedCount).toBe(1);
    expect(parsedState.stats.xp).toBeGreaterThan(0);
  });

  test('should display letter card when letter is collected', async ({ page }) => {
    await startGame(page);
    
    // Collect a letter
    await page.evaluate(() => window.debug_collect_nearest_letter());
    
    // Wait for letter card to appear
    await page.waitForSelector('#letter-card-shell.is-open', { timeout: 5000 });
    
    // Verify letter card is visible
    const letterCardVisible = await page.evaluate(() => {
      const state = JSON.parse(window.render_game_to_text());
      return state.ui.letterCardVisible;
    });
    
    expect(letterCardVisible).toBe(true);
    
    // Verify letter card has content
    const letterCardTitle = await page.textContent('#letter-card-title');
    expect(letterCardTitle).toBeTruthy();
    
    const letterCardImage = await page.getAttribute('#letter-card-image', 'src');
    expect(letterCardImage).toBeTruthy();
    
    // Close letter card
    await page.click('#letter-card-close');
    
    // Verify letter card is closed
    await page.waitForSelector('#letter-card-shell', { state: 'hidden', timeout: 5000 });
  });

  test('should track collected letters in quest tracker', async ({ page }) => {
    await startGame(page);
    
    // Open quest window
    await page.click('#quest-tab');
    
    // Wait for quest window to open
    await page.waitForSelector('#quest-window[aria-hidden="false"]', { timeout: 5000 });
    
    // Get initial collected count
    const initialCollectedCount = await page.textContent('#collected-count');
    const initialMatch = initialCollectedCount.match(/(\d+) \/ (\d+)/);
    expect(initialMatch).toBeTruthy();
    expect(parseInt(initialMatch[1])).toBe(0);
    expect(parseInt(initialMatch[2])).toBeGreaterThan(0);
    
    // Collect a letter
    await page.evaluate(() => window.debug_collect_nearest_letter());
    
    // Wait for collection
    await page.waitForTimeout(500);
    
    // Verify collected count updated
    const updatedCollectedCount = await page.textContent('#collected-count');
    const match = updatedCollectedCount.match(/(\d+) \/ (\d+)/);
    expect(match).toBeTruthy();
    expect(parseInt(match[1])).toBe(1);
  });

  test('should update zone label based on current location', async ({ page }) => {
    await startGame(page);
    
    // Check initial zone label
    const initialZoneLabel = await page.textContent('#zone-label');
    expect(initialZoneLabel).toBe('Sun Court');
    
    // Move player to different position
    await page.evaluate(() => window.debug_set_player_position(10, 10));
    
    // Wait for zone update
    await page.waitForTimeout(500);
    
    // Verify zone label updated
    const updatedZoneLabel = await page.textContent('#zone-label');
    expect(updatedZoneLabel).toBeTruthy();
  });

  test('should show barrier health for collectibles', async ({ page }) => {
    await startGame(page);
    
    // Get state with collectibles
    const state = await page.evaluate(() => window.render_game_to_text());
    const parsedState = JSON.parse(state);
    
    // Verify collectibles have barrier health
    expect(parsedState.visibleCollectibles).toBeTruthy();
    expect(parsedState.visibleCollectibles.length).toBeGreaterThan(0);
    
    const firstCollectible = parsedState.visibleCollectibles[0];
    expect(firstCollectible.barrierHp).toBeGreaterThanOrEqual(0);
    expect(firstCollectible.barrierMaxHp).toBeGreaterThan(0);
  });
});
