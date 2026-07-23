import { clientCreateInvoice } from "./api";
import { getWebApp } from "./telegram";
import { mockActive, mockApi } from "./mock";

export type PaymentStatus = "paid" | "cancelled" | "failed" | "pending";

// In dev mock mode there's no real Telegram payment sheet to open, so
// this just fakes an instant success so the booking flow can still be
// reviewed end to end outside Telegram.
export async function payForSlot(initData: string, slotId: string): Promise<PaymentStatus> {
  if (import.meta.env.DEV && mockActive) {
    await mockApi.clientPaySlot(slotId);
    return "paid";
  }

  const { invoice_url } = await clientCreateInvoice(initData, slotId);
  const webApp = getWebApp();
  if (!webApp?.openInvoice) {
    throw new Error("Оплата доступна только внутри Telegram.");
  }

  return new Promise((resolve) => {
    webApp.openInvoice(invoice_url, (status) => resolve(status));
  });
}
