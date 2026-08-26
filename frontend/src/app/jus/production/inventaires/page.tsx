"use client";

import { CrudPage } from "@/jus/composants/app/crud-page";
import { inventaires } from "@/jus/lib/data/production";

export default function Page() {
  return <CrudPage resource={inventaires} />;
}
