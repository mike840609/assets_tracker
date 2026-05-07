const registry = new Set<() => void>();

export function registerSwipeRow(closeFn: () => void): () => void {
  registry.add(closeFn);
  return () => registry.delete(closeFn);
}

export function closeOtherSwipeRows(ours: () => void): void {
  registry.forEach((fn) => {
    if (fn !== ours) fn();
  });
}
