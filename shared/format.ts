// Formatting helpers shared by the API server and the React client.

export function formatAmount(amount: number): string {
  return Number(amount || 0).toLocaleString('en-IN');
}

// "₹1,68,300"
export function formatINR(amount: number): string {
  return `₹${formatAmount(amount)}`;
}
