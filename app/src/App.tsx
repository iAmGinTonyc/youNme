import { useEffect, useState } from "react";
import { getInitData, getWebApp } from "./lib/telegram";
import { verify } from "./lib/api";
import MasterView from "./views/MasterView";
import ClientView from "./views/ClientView";

type Identity = { telegram_id: number; name: string; role: "master" | "model" };

export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const webApp = getWebApp();
    webApp?.ready();
    webApp?.expand();

    const initData = getInitData();
    if (!initData) {
      setError("Открой это приложение через Telegram — вне Telegram оно не работает.");
      return;
    }
    verify(initData).then(setIdentity).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!identity) return <p>Загрузка…</p>;

  return identity.role === "master" ? (
    <MasterView identity={identity} />
  ) : (
    <ClientView identity={identity} />
  );
}
