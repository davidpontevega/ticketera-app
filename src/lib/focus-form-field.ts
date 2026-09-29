// Enfoca el control de un campo de formulario por id. En checkbox/radio de base-ui el id queda
// en un <input> oculto (aria-hidden), asi que se enfoca el control visible del mismo Field.
export function focusFormField(id: string): void {
  const element = document.getElementById(id);
  if (!element) return;
  const target =
    element.getAttribute("aria-hidden") === "true"
      ? element
          .closest('[data-slot="field"]')
          ?.querySelector<HTMLElement>('[role="checkbox"], [role="radio"]')
      : element;
  target?.focus();
}
