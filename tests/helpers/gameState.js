export async function readState(page) {
  return page.evaluate(() => JSON.parse(window.render_game_to_text()));
}

export async function teleportStage(page, stageKey) {
  await page.evaluate((nextStage) => window.debug_teleport_stage(nextStage), stageKey);
  await page.waitForTimeout(1000);
  return readState(page);
}

export async function collectCurrentStage(page) {
  let state = await readState(page);
  const targetIds = state.alphabet?.currentStageLetterIds ?? [];
  let safety = 0;

  while (targetIds.some((id) => !(state.alphabet?.collectedLetterIds ?? []).includes(id)) && safety < targetIds.length + 5) {
    await page.evaluate(() => {
      void window.debug_collect_nearest_letter();
    });
    await page.waitForTimeout(350);
    state = await readState(page);
    safety += 1;
  }

  return state;
}

export async function openNearestChest(page, chest) {
  await page.evaluate(({ x, z }) => window.debug_set_player_position(x, z), { x: chest.x, z: chest.z });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.debug_interact_nearest());
  await page.waitForTimeout(500);
  return readState(page);
}

export async function useActivePortal(page) {
  const state = await readState(page);
  if (!state.portal) {
    throw new Error('Active portal not found.');
  }

  await page.evaluate(({ x, z }) => window.debug_set_player_position(x, z), { x: state.portal.x, z: state.portal.z });
  await page.waitForTimeout(150);
  await page.evaluate(() => window.advanceTime(1500));
  await page.waitForTimeout(250);
  return readState(page);
}
