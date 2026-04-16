export interface TodoNode {
  id: number;
  dueDate?: string | Date | null;
  dependencies: { id: number }[];
}

/** Returns true if adding an edge todoId->depId would create a cycle. */
export function hasCycle(todos: TodoNode[], todoId: number, depId: number): boolean {
  const depMap = new Map<number, number[]>();
  for (const t of todos) {
    depMap.set(t.id, t.dependencies.map((d) => d.id));
  }
  // Temporarily add the proposed edge
  depMap.set(todoId, [...(depMap.get(todoId) ?? []), depId]);

  // DFS from todoId: if we can reach todoId again, it's a cycle
  const visited = new Set<number>();
  const stack = [depId];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node === todoId) return true;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const dep of depMap.get(node) ?? []) {
      stack.push(dep);
    }
  }
  return false;
}

export interface CriticalPathResult {
  criticalPath: number[];
  earliestStart: Map<number, Date | null>;
}

/**
 * Computes the critical path (longest dependency chain by hop count)
 * and the earliest start date for each todo (= max dueDate of its dependencies).
 */
export function computeCriticalPath(todos: TodoNode[]): CriticalPathResult {
  const byId = new Map(todos.map((t) => [t.id, t]));
  const depMap = new Map<number, number[]>();
  for (const t of todos) {
    depMap.set(t.id, t.dependencies.map((d) => d.id));
  }

  // Memoised DFS: longest chain length ending at node
  const memo = new Map<number, number>();
  function longestChain(id: number): number {
    if (memo.has(id)) return memo.get(id)!;
    const deps = depMap.get(id) ?? [];
    const len = deps.length === 0 ? 0 : Math.max(...deps.map((d) => longestChain(d))) + 1;
    memo.set(id, len);
    return len;
  }

  todos.forEach((t) => longestChain(t.id));
  const maxLen = Math.max(0, ...Array.from(memo.values()));

  // Trace the critical path greedily from the node with maxLen
  const criticalPath: number[] = [];
  let current = todos.find((t) => memo.get(t.id) === maxLen)?.id;
  while (current !== undefined) {
    criticalPath.push(current);
    const deps = depMap.get(current) ?? [];
    const next = deps.reduce<number | undefined>((best, d) => {
      if (best === undefined) return d;
      return (memo.get(d) ?? 0) > (memo.get(best) ?? 0) ? d : best;
    }, undefined);
    current = next;
  }

  // Earliest start: max dueDate among all dependencies
  const earliestStart = new Map<number, Date | null>();
  for (const t of todos) {
    const deps = (depMap.get(t.id) ?? []).map((id) => byId.get(id));
    const dueDates = deps
      .map((d) => (d?.dueDate ? new Date(d.dueDate) : null))
      .filter((d): d is Date => d !== null);
    earliestStart.set(t.id, dueDates.length > 0 ? new Date(Math.max(...dueDates.map((d) => d.getTime()))) : null);
  }

  return { criticalPath, earliestStart };
}
