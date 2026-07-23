import { useEffect, useState } from "react";
import { applyBrandChrome, getInitData, getWebApp } from "./lib/telegram";
import { verify } from "./lib/api";
import { mockIdentity, setMockActive } from "./lib/mock";
import MasterView from "./views/MasterView";
import ClientView from "./views/ClientView";

type Identity = { telegram_id: number; name: string; role: "master" | "model" };

const isDev = import.meta.env.DEV;

export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const webApp = getWebApp();
    webApp?.ready();
    webApp?.expand();
    applyBrandChrome();

    const initData = getInitData();
    if (!initData) {
      if (!isDev) {
        setError("Открой это приложение через Telegram — вне Telegram оно не работает.");
      }
      return;
    }
    verify(initData).then(setIdentity).catch((e) => setError(e.message));
  }, []);

  if (isDev && !identity && !getInitData()) {
    return (
      <div>
        <h1>Дев-превью</h1>
        <p className="meta">Вне Telegram initData нет — выбери, какой кабинет посмотреть. В проде этот экран не собирается.</p>
        <button
          onClick={() => {
            setMockActive(true);
            setIdentity(mockIdentity.master);
          }}
        >
          Кабинет мастера
        </button>
        <button
          className="secondary"
          onClick={() => {
            setMockActive(true);
            setIdentity(mockIdentity.model);
          }}
        >
          Кабинет модели
        </button>
      </div>
    );
  }

  if (error) return <p className="error">{error}</p>;
  if (!identity) return <p>Загрузка…</p>;

  return identity.role === "master" ? (
    <MasterView identity={identity} />
  ) : (
    <ClientView identity={identity} />
  );
}
