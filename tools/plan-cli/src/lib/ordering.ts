/**
 * Sort order calculation helpers for reordering issues
 */

export interface OrderedItem {
  id: string;
  identifier: string;
  sortOrder: number;
}

/**
 * Calculate sortOrder to place item before target
 */
export function calculateBefore(
  items: OrderedItem[],
  targetIdentifier: string
): number | null {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const targetIndex = sorted.findIndex((i) => i.identifier === targetIdentifier);

  if (targetIndex === -1) return null;

  if (targetIndex === 0) {
    // Target is first, place before it
    return sorted[0].sortOrder - 1;
  }

  // Place between previous item and target
  const prev = sorted[targetIndex - 1];
  const target = sorted[targetIndex];
  return (prev.sortOrder + target.sortOrder) / 2;
}

/**
 * Calculate sortOrder to place item after target
 */
export function calculateAfter(
  items: OrderedItem[],
  targetIdentifier: string
): number | null {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const targetIndex = sorted.findIndex((i) => i.identifier === targetIdentifier);

  if (targetIndex === -1) return null;

  if (targetIndex === sorted.length - 1) {
    // Target is last, place after it
    return sorted[targetIndex].sortOrder + 1;
  }

  // Place between target and next item
  const target = sorted[targetIndex];
  const next = sorted[targetIndex + 1];
  return (target.sortOrder + next.sortOrder) / 2;
}

/**
 * Calculate sortOrder to place item at top
 */
export function calculateTop(items: OrderedItem[]): number {
  if (items.length === 0) return 0;
  const minOrder = Math.min(...items.map((i) => i.sortOrder));
  return minOrder - 1;
}

/**
 * Calculate sortOrder to place item at bottom
 */
export function calculateBottom(items: OrderedItem[]): number {
  if (items.length === 0) return 0;
  const maxOrder = Math.max(...items.map((i) => i.sortOrder));
  return maxOrder + 1;
}

/**
 * Calculate sortOrder to move item up N positions
 */
export function calculatePull(
  items: OrderedItem[],
  itemIdentifier: string,
  count: number = 1
): number | null {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentIndex = sorted.findIndex((i) => i.identifier === itemIdentifier);

  if (currentIndex === -1) return null;
  if (currentIndex === 0) return null; // Already at top

  const targetIndex = Math.max(0, currentIndex - count);

  if (targetIndex === 0) {
    // Moving to top
    return sorted[0].sortOrder - 1;
  }

  // Place between targetIndex-1 and targetIndex
  const prev = sorted[targetIndex - 1];
  const target = sorted[targetIndex];
  return (prev.sortOrder + target.sortOrder) / 2;
}

/**
 * Calculate sortOrder to move item down N positions
 */
export function calculatePush(
  items: OrderedItem[],
  itemIdentifier: string,
  count: number = 1
): number | null {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const currentIndex = sorted.findIndex((i) => i.identifier === itemIdentifier);

  if (currentIndex === -1) return null;
  if (currentIndex === sorted.length - 1) return null; // Already at bottom

  const targetIndex = Math.min(sorted.length - 1, currentIndex + count);

  if (targetIndex === sorted.length - 1) {
    // Moving to bottom
    return sorted[sorted.length - 1].sortOrder + 1;
  }

  // Place between targetIndex and targetIndex+1
  const target = sorted[targetIndex];
  const next = sorted[targetIndex + 1];
  return (target.sortOrder + next.sortOrder) / 2;
}
