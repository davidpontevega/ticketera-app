import type { Metadata } from "next";

import { StoragePanel } from "@/modules/dev";

export const metadata: Metadata = { title: "Datos de prueba | Ticketera" };

export default function DevStoragePage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6 lg:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Datos de prueba</h1>
        <p className="text-muted-foreground">
          La app no tiene backend: cuentas, sesion, pedidos, eventos y correos se guardan en el
          almacenamiento de este navegador.
        </p>
      </div>
      <StoragePanel />
    </div>
  );
}
