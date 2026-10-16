const SECTIONS = [
  {
    title: "Evento cancelado",
    body: "Si el organizador cancela un evento, reembolsamos el 100 % de lo que pagaste, de forma automatica y a la forma de pago original. No necesitas solicitarlo. La acreditacion depende de tu banco y suele tardar entre 5 y 10 dias habiles.",
  },
  {
    title: "Evento reprogramado",
    body: "Si el evento cambia de fecha, tu entrada sigue siendo valida para la nueva fecha.",
  },
  {
    title: "Casos que no se reembolsan",
    body: "No se reembolsan las entradas extraviadas, la inasistencia al evento ni las entradas que ya fueron usadas en puerta.",
  },
  {
    title: "Reembolso a pedido",
    body: "La solicitud de reembolso por parte del comprador aun no esta disponible.",
  },
] as const;

export function RefundPolicy() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-6 md:px-6 lg:py-10">
      <h1 className="font-heading text-2xl font-semibold">Politica de reembolsos</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Este resumen es informativo y no sustituye los terminos y condiciones.
      </p>
      {SECTIONS.map(({ title, body }) => (
        <section key={title} className="mt-6">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-muted-foreground">{body}</p>
        </section>
      ))}
    </article>
  );
}
