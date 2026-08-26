"use client";

import { CrudPage } from "@/jus/composants/app/crud-page";
import { receptions } from "@/jus/lib/data/production";

export default function Page() {
  return <CrudPage resource={receptions} />;
}
