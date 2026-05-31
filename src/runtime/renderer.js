import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import WebGPU from "three/addons/capabilities/WebGPU.js";

function configureShadowMap(renderer, qualityProfile) {
  if (!renderer.shadowMap) {
    return;
  }

  renderer.shadowMap.enabled = qualityProfile.enableShadows;
  renderer.shadowMap.type = qualityProfile.enableShadows ? THREE.PCFSoftShadowMap : THREE.BasicShadowMap;
}

export function configureRenderer(renderer, qualityProfile) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, qualityProfile.pixelRatioCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  configureShadowMap(renderer, qualityProfile);

  if ("outputColorSpace" in renderer) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  if ("toneMapping" in renderer) {
    renderer.toneMapping = qualityProfile.lowSpec ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  }

  if ("toneMappingExposure" in renderer) {
    renderer.toneMappingExposure = qualityProfile.lowSpec ? 1 : 1.1;
  }
}

/**
 * Safely disposes a WebGPU renderer, ensuring all pending commands complete first.
 * This prevents the "Buffer used in submit while destroyed" error.
 */
async function safeDisposeWebGPURenderer(renderer) {
  if (!renderer) {
    return;
  }

  try {
    // Stop the animation loop first to prevent new render calls
    renderer.setAnimationLoop(null);

    // Force a final render to complete any pending operations
    // This ensures no buffers are in-flight when we dispose
    if (renderer._context) {
      renderer._context.pop?.();
    }

    // Dispose the renderer which will clean up all WebGPU resources
    renderer.dispose();
  } catch (error) {
    // Suppress disposal errors - renderer may already be partially destroyed
    console.warn("WebGPU renderer disposal warning:", error);
  }
}

export async function createGameRenderer({ canvas, qualityProfile }) {
  const webgpuSupported = WebGPU.isAvailable();
  const parameters = {
    canvas,
    antialias: !qualityProfile.lowSpec,
    alpha: false,
    powerPreference: "high-performance",
  };

  if (webgpuSupported) {
    let webgpuRenderer = null;
    try {
      webgpuRenderer = new WebGPURenderer(parameters);

      // Set up device loss handling BEFORE init
      // This catches the "Buffer used in submit while destroyed" error
      if (webgpuRenderer.backend?.device) {
        webgpuRenderer.backend.device.lost.then((info) => {
          console.warn("WebGPU device lost:", info.message, "Reason:", info.reason);
          // Mark WebGPU as unavailable to force fallback on next attempt
          WebGPU._available = false;
        });
      }

      await webgpuRenderer.init();

      if (webgpuRenderer.backend?.isWebGPUBackend === true) {
        configureRenderer(webgpuRenderer, qualityProfile);
        return {
          renderer: webgpuRenderer,
          backend: "webgpu",
          usingWebGPU: true,
          webgpuSupported,
        };
      }

      // Backend failed to initialize properly - dispose and fall back
      await safeDisposeWebGPURenderer(webgpuRenderer);
      webgpuRenderer = null;
    } catch (error) {
      console.warn("WebGPU renderer bootstrap failed, falling back to WebGLRenderer.", error);
      // Ensure cleanup on error
      if (webgpuRenderer) {
        await safeDisposeWebGPURenderer(webgpuRenderer);
      }
    }
  }

  // Fallback to WebGLRenderer
  const renderer = new THREE.WebGLRenderer(parameters);
  configureRenderer(renderer, qualityProfile);

  return {
    renderer,
    backend: "webgl",
    usingWebGPU: false,
    webgpuSupported,
  };
}
