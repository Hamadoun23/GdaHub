"use client";

import { CrudPage } from "@/jus/composants/app/crud-page";
import { conditionnements } from "@/jus/lib/data/production";

export default function Page() {
  return <CrudPage resource={conditionnements} />;
}
