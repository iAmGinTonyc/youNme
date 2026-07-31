// Called once when the Mini App opens. Confirms who the caller is and
// whether they're a master, purely so the frontend knows which view to
// render. It is NOT a login: every other function re-verifies initData
// independently and does not trust anything this function returned.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyInitData } from "../_shared/verifyInitData.ts";
import { handleOptions, json } from "../_shared/http.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const { initData } = await req.json().catch(() => ({ initData: null }));
  const user = await verifyInitData(initData, BOT_TOKEN);
  if (!user) return json({ error: "invalid_init_data" }, 401);

  const { data: master } = await supabase
    .from("masters")
    .select("telegram_id, name")
    .eq("telegram_id", user.id)
    .maybeSingle();

  const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username || "—";

  // Keep masters.name in sync with their live Telegram profile — it's
  // used in booking/reminder messages sent to the model, who has no
  // other way to see it. Self-heals on every open instead of relying on
  // whoever inserted the row via SQL to have set it (or to update it if
  // the master ever changes their Telegram name).
  if (master && master.name !== displayName) {
    await supabase.from("masters").update({ name: displayName }).eq("telegram_id", user.id);
  }

  return json({
    telegram_id: user.id,
    name: displayName,
    role: master ? "master" : "model",
  }, 200);
});
