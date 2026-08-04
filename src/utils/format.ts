export { formatAmount, formatINR } from '../../shared/format';

// "04/08/2026"
export function formatDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString('en-GB');
}

// "04/08/2026, 08:16:30"
export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString('en-GB');
}
