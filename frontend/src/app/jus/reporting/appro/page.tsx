"use client";

import { RapportPage } from "@/jus/composants/app/rapport-page";
import { rapportAppro } from "@/jus/lib/data/rapports";

export default function Page() {
  return <RapportPage config={rapportAppro} />;
}
