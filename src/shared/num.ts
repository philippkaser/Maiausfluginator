/** German decimals — 9,0 rather than 9.0. Shared so the server agrees. */
export function de1(value: number): string {
  return value.toFixed(1).replace(".", ",");
}
