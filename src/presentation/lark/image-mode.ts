let imageModeEnabled = false;

export function isImageModeEnabled(): boolean {
  return imageModeEnabled;
}

export function setImageModeEnabled(enabled: boolean): void {
  imageModeEnabled = enabled;
}

/** Image-mode commands must remain reachable while all other input is intercepted. */
export function isImageModeCommand(text: string): boolean {
  return /^\/image(?:\s|$)/i.test(text.trim());
}
