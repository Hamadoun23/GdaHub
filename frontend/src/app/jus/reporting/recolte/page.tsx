"use client";

import { RapportPage } from "@/jus/composants/app/rapport-page";
import { rapportRecolte } from "@/jus/lib/data/rapports";

export default function Page() {
  return <RapportPage config={rapportRecolte} />;
}
