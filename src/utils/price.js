const priceFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function formatPrice(value) {
  if (!(Number(value) > 0)) return "Gratis";
  return `ARS ${priceFormatter.format(Number(value))}`;
}
