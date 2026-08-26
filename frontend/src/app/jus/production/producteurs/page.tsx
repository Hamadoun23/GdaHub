"use client";

import { CrudPage } from "@/jus/composants/app/crud-page";
import { producteurs } from "@/jus/lib/data/production";

export default function Page() {
  return <CrudPage resource={producteurs} />;
}
