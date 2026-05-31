import { test, expect, devices } from '@playwright/test';
import { startGame } from './helpers/startGame.js';
import { readState } from './helpers/gameState.js';

const SETTINGS_KEY = 'sun-court-settings-v2';

async function waitForRuntime(page) {
  await page.goto('http://127.0.0.1:4173');
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function', null, { timeout: 30000 });
}

test.describe('Phase 1 stabilization', () => {
  test('fresh storage defaults music off', async ({ page }) => {
    await page.addInitScript((storageKey) => {
      window.localStorage.removeItem(storageKey);
    }, SETTINGS_KEY);

    await waitForRuntime(page);
    const state = await readState(page);

    expect(state.audio.musicEnabled).toBe(false);
  });

  test('saved explicit music choice stays on', async ({ page }) => {
    await page.addInitScript((storageKey) => {
      window.localStorage.setItem(storageKey, JSON.stringify({
        settingsVersion: 3,
        musicEnabled: true,
      }));
    }, SETTINGS_KEY);

    await waitForRuntime(page);
    const state = await readState(page);

    expect(state.audio.musicEnabled).toBe(true);
  });

  test('synthetic 50-player roster keeps full count under render cap', async ({ page }) => {
    await waitForRuntime(page);
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode !== 'loading', null, { timeout: 30000 });
    const mode = await page.evaluate(() => JSON.parse(window.render_game_to_text()).mode);
    if (mode === 'menu') {
      await page.evaluate(() => window.resetGame());
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode !== 'menu', null, { timeout: 10000 });
    }
    await page.evaluate(() => window.debug_set_multiplayer_roster(50, { sameMap: true }));
    await page.waitForTimeout(250);

    const state = await readState(page);

    expect(state.multiplayer.onlineCount).toBe(50);
    expect(state.multiplayer.remoteRosterCount).toBe(50);
    expect(state.multiplayer.sameMapRosterCount).toBe(50);
    expect(state.multiplayer.renderedRemoteCount).toBeLessThanOrEqual(state.multiplayer.remoteCap);
    expect(state.multiplayer.remoteLabelCount).toBeLessThanOrEqual(state.multiplayer.remoteLabelCap);
    expect(state.multiplayer.coalescedRosterEventCount).toBeGreaterThanOrEqual(0);
  });

  test('letter card reopens from the top after scrolling', async ({ page }) => {
    await startGame(page);
    await page.evaluate(() => window.debug_collect_nearest_letter());
    await page.waitForSelector('#letter-card-shell.is-open', { timeout: 5000 });

    const scrolled = await page.evaluate(() => {
      const panel = document.querySelector('.letter-card');
      if (!panel) {
        return -1;
      }
      panel.scrollTop = panel.scrollHeight;
      return panel.scrollTop;
    });
    expect(scrolled).toBeGreaterThan(0);

    await page.click('#letter-card-close');
    await page.waitForTimeout(150);
    await page.evaluate(() => {
      document.querySelector('.alphabet-chip.is-collected, .alphabet-chip[aria-pressed="true"]')?.click();
    });
    await page.waitForSelector('#letter-card-shell.is-open', { timeout: 5000 });

    const scrollTop = await page.evaluate(() => document.querySelector('.letter-card')?.scrollTop ?? -1);
    expect(scrollTop).toBe(0);
  });

  test('glyph pronunciation triggers speech immediately on click', async ({ page }) => {
    await page.addInitScript(() => {
      class MockUtterance {
        constructor(text) {
          this.text = text;
          this.lang = '';
          this.rate = 1;
          this.pitch = 1;
          this.volume = 1;
          this.voice = null;
        }
      }

      const calls = [];
      const speech = {
        speaking: false,
        pending: false,
        paused: false,
        getVoices: () => [{ lang: 'ar-SA', name: 'Mock Arabic' }],
        addEventListener: () => {},
        cancel() {
          this.speaking = false;
        },
        resume() {},
        speak(utterance) {
          calls.push({ text: utterance.text, at: performance.now() });
          this.speaking = true;
          utterance.onstart?.();
          setTimeout(() => {
            this.speaking = false;
            utterance.onend?.();
          }, 0);
        },
      };

      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        writable: true,
        value: MockUtterance,
      });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: speech,
      });
      window.__ttsCalls = calls;
    });

    await startGame(page);
    await page.evaluate(() => window.debug_collect_nearest_letter());
    await page.waitForSelector('#letter-card-shell.is-open', { timeout: 5000 });

    const result = await page.evaluate(() => {
      window.__ttsCalls.length = 0;
      document.querySelector('#letter-card-glyph-button')?.click();
      return {
        callCount: window.__ttsCalls.length,
        speaking: document.querySelector('#letter-card-shell')?.classList.contains('is-speaking') ?? false,
      };
    });

    expect(result.callCount).toBeGreaterThan(0);
    expect(result.speaking).toBe(true);
  });

  test('non-charge skills keep movement alive while held input continues', async ({ page }) => {
    await startGame(page);

    const movementResults = await page.evaluate(async () => {
      const testableSkills = window.debug_get_skill_effects()
        .filter((skill) => skill.effectType !== 'charge');

      const results = [];
      for (const skill of testableSkills) {
        window.debug_reset_skill_state();
        window.debug_set_player_position(0, 18, Math.PI);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', bubbles: true }));
        await window.advanceTime(100);
        const before = JSON.parse(window.render_game_to_text());
        const used = window.debug_use_skill(skill.id);
        await window.advanceTime(300);
        const after = JSON.parse(window.render_game_to_text());
        document.dispatchEvent(new KeyboardEvent('keyup', { key: 'w', bubbles: true }));

        results.push({
          id: skill.id,
          used,
          moved: Math.hypot(after.player.x - before.player.x, after.player.z - before.player.z),
          cooldown: after.skills.find((entry) => entry.id === skill.id)?.cd ?? 0,
        });
      }

      return results;
    });

    for (const result of movementResults) {
      expect(result.used, `${result.id} should activate`).toBe(true);
      expect(result.moved, `${result.id} should preserve movement`).toBeGreaterThan(0.4);
      expect(result.cooldown, `${result.id} should consume cooldown`).toBeGreaterThan(0);
    }
  });

  test('mobile fps chip stays compact and avoids minimap/touch controls', async ({ browser }) => {
    const context = await browser.newContext({
      ...devices['iPhone 13'],
    });
    const page = await context.newPage();

    await startGame(page);
    await page.evaluate(() => {
      const checkbox = document.querySelector('#settings-show-fps');
      if (checkbox instanceof HTMLInputElement && !checkbox.checked) {
        checkbox.checked = true;
      }
      document.querySelector('#settings-apply')?.click();
    });
    await page.waitForTimeout(200);

    const metrics = await page.evaluate(() => {
      const fps = document.querySelector('#fps-meter')?.getBoundingClientRect();
      const minimap = document.querySelector('.minimap-shell')?.getBoundingClientRect();
      const touchActions = document.querySelector('#touch-actions')?.getBoundingClientRect();
      return {
        fps,
        minimap,
        touchActions,
        label: document.querySelector('#fps-meter')?.textContent?.trim() ?? '',
      };
    });

    expect(metrics.fps.width).toBeLessThan(84);
    expect(metrics.fps.height).toBeLessThan(36);
    expect(metrics.label.length).toBeLessThanOrEqual(4);
    expect(metrics.fps.bottom <= metrics.touchActions.top || metrics.fps.top >= metrics.touchActions.bottom).toBe(true);
    expect(metrics.fps.right <= metrics.minimap.left || metrics.fps.left >= metrics.minimap.right || metrics.fps.bottom <= metrics.minimap.top).toBe(true);

    await context.close();
  });
});
