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

// Opens a t.me link inside the Telegram client if we're running as a Mini
// App, or a plain new tab in dev.
export function openTelegramLink(url: string) {
  const webApp = getWebApp();
  if (webApp) {
    webApp.openTelegramLink(url);
  } else {
    window.open(url, "_blank");
  }
}

// Opens Telegram's native "forward to a chat" sheet for a link.
export function shareToTelegram(link: string, text: string) {
  openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
}

export function openTelegramProfile(username: string) {
  openTelegramLink(`https://t.me/${username}`);
}
