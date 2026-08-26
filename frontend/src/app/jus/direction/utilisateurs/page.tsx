"use client";

import { CrudPage } from "@/jus/composants/app/crud-page";
import { utilisateurs } from "@/jus/lib/data/users";

export default function Page() {
  return <CrudPage resource={utilisateurs} />;
}
