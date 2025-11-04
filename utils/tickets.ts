// Fix: Implementing a utility function to format event prices.

/**
 * Formats a numeric price into a Zambian Kwacha string.
 * @param price The price as a number.
 * @returns A formatted string, e.g., "K250" or "Free".
 */
export const formatPrice = (price: number): string => {
    if (price === 0) {
      return 'Free';
    }
    return `K${price}`;
};
