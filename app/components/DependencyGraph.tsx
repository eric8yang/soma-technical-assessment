'use client';

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface TodoItem {
  id: number;
  title: string;
  dependencies: { id: number; title: string }[];
}

interface Props {
  todos: TodoItem[];
  criticalPath: number[];
}

export default function DependencyGraph({ todos, criticalPath }: Props) {
  const criticalSet = new Set(criticalPath);

  const { nodes, edges } = useMemo(() => {
    const cols = Math.ceil(Math.sqrt(todos.length));
    const nodes: Node[] = todos.map((todo, i) => ({
      id: String(todo.id),
      data: { label: todo.title },
      position: { x: (i % cols) * 200, y: Math.floor(i / cols) * 100 },
      style: criticalSet.has(todo.id)
        ? { background: '#ef4444', color: '#fff', border: '2px solid #b91c1c', borderRadius: 8 }
        : { background: '#fff', border: '2px solid #f97316', borderRadius: 8 },
    }));

    const edges: Edge[] = todos.flatMap((todo) =>
      todo.dependencies.map((dep) => ({
        id: `${dep.id}-${todo.id}`,
        source: String(dep.id),
        target: String(todo.id),
        animated: criticalSet.has(dep.id) && criticalSet.has(todo.id),
        style: criticalSet.has(dep.id) && criticalSet.has(todo.id)
          ? { stroke: '#ef4444', strokeWidth: 2 }
          : { stroke: '#f97316' },
      }))
    );

    return { nodes, edges };
  }, [todos, criticalPath]);

  if (todos.length === 0) return null;

  return (
    <div className="w-full h-72 rounded-xl overflow-hidden border border-white/30 bg-white/10">
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
