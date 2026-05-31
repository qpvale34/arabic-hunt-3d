export function shouldRegisterGameDebugApi(env = import.meta.env) {
  return Boolean(env?.DEV) || String(env?.VITE_ENABLE_DEBUG_API ?? "").trim() === "1";
}

export function registerGameDebugApi(app, target = globalThis.window) {
  if (!target || !shouldRegisterGameDebugApi()) {
    return false;
  }

  target.render_game_to_text = () => app.renderGameToText();
  target.advanceTime = async (ms) => {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let index = 0; index < steps; index += 1) {
      app.update(1 / 60);
      await app.flushSimulation();
    }
    app.render();
  };
  target.resetGame = () => app.resetGame(false);
  target.debug_set_player_position = (x, z, heading) => app.debugSetPlayerPosition(x, z, heading);
  target.debug_interact_nearest = () => app.debugInteractNearest();
  target.debug_collect_nearest_letter = () => app.debugCollectNearestLetter();
  target.debug_teleport_stage = (stageKey) => app.transitionToStage(stageKey);
  target.debug_use_skill = (id) => app.useSkill(id);
  target.debug_get_skill_effects = () => app.state.skills.map((skill) => ({
    id: skill.id,
    effectType: skill.effectType,
  }));
  target.debug_reset_skill_state = () => {
    app.state.stats.mp = app.state.stats.maxMp;
    app.state.skills.forEach((skill) => {
      skill.cooldownLeft = 0;
    });
    app.state.cooldownsDirty = true;
    return true;
  };
  target.debug_set_multiplayer_roster = (playersOrCount, options = {}) => {
    const sameMap = options.sameMap !== false;
    const count = Number(playersOrCount);
    const characters = Object.values(app.characterDefinitions);
    const roster = Array.isArray(playersOrCount)
      ? playersOrCount
      : Array.from({ length: Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0 }, (_, index) => {
        const angle = (index / Math.max(Math.round(count), 1)) * Math.PI * 2;
        const radius = 8 + ((index % 5) * 3.2);
        const activeMapKey = app.getActiveMultiplayerMapKey();
        const mapKey = sameMap
          ? activeMapKey
          : (index % 2 === 0 ? activeMapKey : "halloweenHollows");
        return {
          id: `debug-player-${index + 1}`,
          name: `Bot ${index + 1}`,
          mapKey,
          currentMap: mapKey,
          stageKey: mapKey,
          position: {
            x: Number((Math.cos(angle) * radius).toFixed(2)),
            z: Number((Math.sin(angle) * radius).toFixed(2)),
            heading: Number((angle + Math.PI).toFixed(3)),
          },
          score: {
            total: (index + 1) * 100,
            collectedCount: Math.min(app.totalLetterCount, index % Math.max(app.totalLetterCount, 1)),
            gold: index * 3,
          },
          characterId: characters[index % characters.length]?.id ?? "knight",
        };
      });
    app.state.session.roster = roster;
    app.state.session.pendingRoster = null;
    app.syncMultiplayerSummary();
    app.scheduleRemotePlayerRosterSync("debug-roster", { immediate: true });
    app.flushRemotePlayerRosterSync();
    app.updateOverlays(0, true);
    app.render();
    return roster.length;
  };

  return true;
}
