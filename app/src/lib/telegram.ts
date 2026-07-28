export function getWebApp(): TelegramWebApp | undefined {
  return window.Telegram?.WebApp;
}

export function getInitData(): string {
  return getWebApp()?.initData ?? "";
}

// The app commits to one fixed dark+gold look regardless of the viewer's
// Telegram theme, so the native chrome (header/bottom bar) needs to be
// told to match rather than following --tg-theme-* automatically.
export function applyBrandChrome() {
  const webApp = getWebApp();
  webApp?.setHeaderColor("#0b1f3a");
  webApp?.setBackgroundColor("#0b1f3a");
  webApp?.setBottomBarColor("#0b1f3a");
}
