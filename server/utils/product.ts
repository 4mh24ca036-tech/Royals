// Converts a raw `products` row (JSON columns, integer booleans) into the
// shape the client expects.
export function formatProductRow(row: any, extra: Record<string, any> = {}) {
  return {
    ...row,
    sizes: JSON.parse(row.sizes_json || '[]'),
    images: JSON.parse(row.images_json || '[]'),
    is_featured: Boolean(row.is_featured),
    is_new_arrival: Boolean(row.is_new_arrival),
    ...extra
  };
}
