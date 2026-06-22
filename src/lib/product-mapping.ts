// Shared product/sub-product normalization. Works for any data source
// (DB rows, Excel imports, PDF parses) that may flatten sub-products
// into the product field.

export const PRODUCT_MAP: { key: string; label: string }[] = [
  { key: "frame", label: "Frames" },
  { key: "hand", label: "Hand" },
  { key: "wheel", label: "Wheels" },
  { key: "trolley", label: "Trolley" },
];

const EM_DASH = "—";

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Resolve a (product, subProduct) pair from any combination of raw fields.
 * - If an explicit subName is provided, trust it and only normalize the parent label.
 * - Otherwise, try to detect a known parent inside the productName string;
 *   if the value differs from the parent label, treat the value as the sub-product.
 */
export function getProductAndSubProduct(
  productNameRaw: unknown,
  subNameRaw: unknown = null,
): { product: string; subProduct: string } {
  const productName = clean(productNameRaw);
  const subName = clean(subNameRaw);

  if (!productName && !subName) return { product: EM_DASH, subProduct: EM_DASH };

  const lower = productName.toLowerCase();
  const match = PRODUCT_MAP.find((p) => lower.includes(p.key));

  if (subName) {
    return {
      product: match ? match.label : productName || EM_DASH,
      subProduct: subName,
    };
  }

  if (match) {
    const isSameAsParent = productName.toLowerCase() === match.label.toLowerCase();
    return {
      product: match.label,
      subProduct: isSameAsParent ? EM_DASH : productName,
    };
  }

  return { product: productName || EM_DASH, subProduct: EM_DASH };
}
