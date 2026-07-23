/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface TelegramWebApp {
  initData: string;
  ready(): void;
  expand(): void;
  colorScheme: "light" | "dark";
  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  setBottomBarColor(color: string): void;
}

interface Window {
  Telegram?: { WebApp: TelegramWebApp };
}
