/**
 * Tracks whether the user has downloaded Apple Translation language packs
 * during the current app session. Reset to null on each cold start.
 *
 * null  = not yet checked (SplashScreen hasn't run yet)
 * true  = user confirmed and packs were downloaded
 * false = user skipped the download step
 */
let _packsDownloaded: boolean | null = null;

export function markPacksDownloaded(): void {
  _packsDownloaded = true;
}

export function markPacksSkipped(): void {
  _packsDownloaded = false;
}

export function arePacksDownloaded(): boolean | null {
  return _packsDownloaded;
}
