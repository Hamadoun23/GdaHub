"use client";

import { RapportPage } from "@/jus/composants/app/rapport-page";
import { rapportDistribution } from "@/jus/lib/data/rapports";

export default function Page() {
  return <RapportPage config={rapportDistribution} />;
}
