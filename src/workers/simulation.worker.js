import RAPIER from "@dimforge/rapier3d-compat";

const workerState = {
  ready: false,
  world: null,
  controller: null,
  playerBody: null,
  playerCollider: null,
  playerY: 1.18,
  floorTop: 0,
  bounds: null,
  collectibles: [],
  chests: [],
};

const rapierReady = RAPIER.init().then(() => {
  workerState.ready = true;
  self.postMessage({ type: "ready", version: RAPIER.version() });
});

function createDeferredVector(x = 0, y = 0, z = 0) {
  return { x, y, z };
}

function destroyWorld() {
  if (workerState.world) {
    workerState.world.free();
  }

  workerState.world = null;
  workerState.controller = null;
  workerState.playerBody = null;
  workerState.playerCollider = null;
}

function findNearest(items, position, disabledKey) {
  let nearestId = null;
  let nearestDistance = null;

  for (const item of items) {
    if (item[disabledKey]) {
      continue;
    }

    const dx = item.x - position.x;
    const dz = item.z - position.z;
    const distance = Math.hypot(dx, dz);
    if (nearestDistance === null || distance < nearestDistance) {
      nearestId = item.id;
      nearestDistance = distance;
    }
  }

  return {
    id: nearestId,
    distance: nearestDistance,
  };
}

function snapshot() {
  if (!workerState.playerBody) {
    return null;
  }

  const translation = workerState.playerBody.translation();
  const nearestCollectible = findNearest(workerState.collectibles, translation, "collected");
  const nearestChest = findNearest(workerState.chests, translation, "opened");

  return {
    position: {
      x: translation.x,
      y: workerState.floorTop,
      z: translation.z,
    },
    nearestCollectibleId: nearestCollectible.id,
    nearestCollectibleDistance: nearestCollectible.distance,
    nearestChestId: nearestChest.id,
    nearestChestDistance: nearestChest.distance,
  };
}

function configureWorld(payload) {
  destroyWorld();

  workerState.floorTop = payload.floorTop ?? 0;
  workerState.playerY = payload.playerY ?? 1.18;
  workerState.bounds = payload.bounds ?? null;
  workerState.collectibles = (payload.collectibles ?? []).map((entry) => ({ ...entry }));
  workerState.chests = (payload.chests ?? []).map((entry) => ({ ...entry }));

  const world = new RAPIER.World(createDeferredVector(0, 0, 0));
  world.timestep = payload.timestep ?? 1 / 60;
  world.lengthUnit = 1;
  world.numSolverIterations = 2;
  world.numInternalPgsIterations = 1;
  world.maxCcdSubsteps = 1;

  for (const blocker of payload.blockers ?? []) {
    const desc = RAPIER.ColliderDesc.cuboid(
      blocker.halfX + (blocker.skin ?? 0),
      blocker.halfY ?? 2.6,
      blocker.halfZ + (blocker.skin ?? 0),
    ).setTranslation(blocker.x, workerState.playerY, blocker.z);

    world.createCollider(desc);
  }

  const playerBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(payload.playerStart?.x ?? 0, workerState.playerY, payload.playerStart?.z ?? 0)
      .lockRotations()
      .restrictTranslations(true, false, true),
  );

  const playerCollider = world.createCollider(
    RAPIER.ColliderDesc.ball(payload.playerRadius ?? 0.82)
      .setFriction(0)
      .setRestitution(0),
    playerBody,
  );

  const controller = world.createCharacterController(0.05);
  controller.setSlideEnabled(true);
  controller.setApplyImpulsesToDynamicBodies(false);

  workerState.world = world;
  workerState.controller = controller;
  workerState.playerBody = playerBody;
  workerState.playerCollider = playerCollider;

  return snapshot();
}

function clampToBounds(position) {
  if (!workerState.bounds) {
    return position;
  }

  return {
    x: Math.min(workerState.bounds.maxX, Math.max(workerState.bounds.minX, position.x)),
    y: position.y,
    z: Math.min(workerState.bounds.maxZ, Math.max(workerState.bounds.minZ, position.z)),
  };
}

function resetPlayer(position) {
  if (!workerState.playerBody || !workerState.world) {
    return null;
  }

  const target = clampToBounds({
    x: position?.x ?? 0,
    y: workerState.playerY,
    z: position?.z ?? 0,
  });

  workerState.playerBody.setTranslation(target, true);
  workerState.world.propagateModifiedBodyPositionsToColliders();
  return snapshot();
}

function markCollectible(id, collected) {
  const entry = workerState.collectibles.find((collectible) => collectible.id === id);
  if (entry) {
    entry.collected = collected;
  }
  return snapshot();
}

function markChest(id, opened) {
  const entry = workerState.chests.find((chest) => chest.id === id);
  if (entry) {
    entry.opened = opened;
  }
  return snapshot();
}

function stepWorld(payload) {
  if (!workerState.world || !workerState.controller || !workerState.playerBody || !workerState.playerCollider) {
    return null;
  }

  const current = workerState.playerBody.translation();
  const desired = payload.desiredTranslation ?? createDeferredVector(0, 0, 0);
  workerState.controller.computeColliderMovement(workerState.playerCollider, desired);

  const movement = workerState.controller.computedMovement();
  const next = clampToBounds({
    x: current.x + movement.x,
    y: workerState.playerY,
    z: current.z + movement.z,
  });

  workerState.playerBody.setNextKinematicTranslation(next);
  workerState.world.step();

  const actual = workerState.playerBody.translation();
  const deltaX = actual.x - current.x;
  const deltaZ = actual.z - current.z;
  const deltaTime = Math.max(payload.delta ?? 1 / 60, 1 / 240);

  return {
    ...snapshot(),
    delta: {
      x: deltaX,
      z: deltaZ,
    },
    motionAmount: Math.min(1, Math.hypot(deltaX, deltaZ) / deltaTime),
  };
}

self.onmessage = async (event) => {
  await rapierReady;

  const payload = event.data;

  try {
    switch (payload.type) {
      case "configure":
        self.postMessage({
          type: "configured",
          snapshot: configureWorld(payload),
        });
        break;
      case "reset":
        self.postMessage({
          type: "resetAck",
          snapshot: resetPlayer(payload.position),
        });
        break;
      case "step":
        self.postMessage({
          type: "stepResult",
          id: payload.id,
          snapshot: stepWorld(payload),
        });
        break;
      case "collectibleState":
        self.postMessage({
          type: "collectibleAck",
          snapshot: markCollectible(payload.id, payload.collected),
        });
        break;
      case "chestState":
        self.postMessage({
          type: "chestAck",
          snapshot: markChest(payload.id, payload.opened),
        });
        break;
      default:
        break;
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : "",
    });
  }
};
