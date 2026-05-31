export async function startGame(page, { mapName = 'Sun Court' } = {}) {
  await page.goto('http://localhost:4173');
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function', null, { timeout: 30000 });
  await page.waitForSelector('.map-card, #start-btn', { timeout: 30000 });

  const mapSelect = page.locator('#map-select');
  if (await mapSelect.isVisible().catch(() => false)) {
    await page.evaluate((preferredMapName) => {
      const cards = [...document.querySelectorAll('.map-card')];
      const target = cards.find((card) => card.textContent?.includes(preferredMapName)) ?? cards[0];
      target?.click();
      return Boolean(target);
    }, mapName);
    await page.waitForSelector('#menu.is-visible', { timeout: 10000 });
  }

  const playerNameInput = page.locator('#player-name-input');
  if (await playerNameInput.count()) {
    const currentValue = await playerNameInput.inputValue().catch(() => '');
    if (!currentValue.trim()) {
      await playerNameInput.fill('Test Oyuncu');
    }
  }

  await page.waitForSelector('#start-btn:not([disabled])', { timeout: 30000 });
  await page.click('#start-btn');
  await page.waitForTimeout(400);
  const modeAfterJoin = await page.evaluate(() => JSON.parse(window.render_game_to_text()).mode);
  if (modeAfterJoin === 'menu') {
    await page.evaluate(() => window.resetGame());
  }
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode !== 'menu', null, { timeout: 10000 });
}
