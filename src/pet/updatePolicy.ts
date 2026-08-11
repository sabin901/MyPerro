const RELEASE_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const LOCAL_CHANNEL = /(?:^|[-+.])(dev|local)(?:[.-]|$)/i;

export const INITIAL_UPDATE_CHECK_MS = 15_000;
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60_000;

/**
 * Signed release candidates use the same verified channel as stable builds.
 * Only developer/local binaries stay offline so development never produces
 * misleading update notices or contacts the public release endpoint.
 */
export function shouldPollForUpdates(version: string): boolean {
  const value = version.trim();
  return RELEASE_VERSION.test(value) && value !== "0.0.0" && !LOCAL_CHANNEL.test(value);
}
