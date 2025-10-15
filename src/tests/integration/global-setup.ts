import { startTestContainers, stopTestContainers } from './shared/test-infrastructure';

// AIDEV-NOTE: Global setup for integration tests
// Now delegates to shared infrastructure module to avoid code duplication

export async function setup() {
  await startTestContainers();
}

export async function teardown() {
  await stopTestContainers();
}