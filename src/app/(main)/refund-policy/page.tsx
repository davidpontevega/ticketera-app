import type { Metadata } from "next";

import { RefundPolicy } from "@/modules/order";

export const metadata: Metadata = { title: "Politica de reembolsos | Ticketera" };

export default function RefundPolicyPage() {
  return <RefundPolicy />;
}
