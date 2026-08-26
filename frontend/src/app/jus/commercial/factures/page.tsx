"use client";

import { CrudPage } from "@/jus/composants/app/crud-page";
import { factures } from "@/jus/lib/data/commercial";

export default function Page() {
  return <CrudPage resource={factures} />;
}
