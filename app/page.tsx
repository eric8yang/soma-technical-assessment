'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { computeCriticalPath } from '@/lib/graph';
// computeCriticalPath still used for earliestStart; isCritical is manually set

const DependencyGraph = dynamic(() => import('./components/DependencyGraph'), { ssr: false });

// Returns the actual Eastern offset ("-05:00" or "-04:00") for a given YYYY-MM-DD date.
function easternOffset(dateStr: string): string {
  const noon = new Date(`${dateStr}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/New_York',
    timeZoneName: 'shortOffset',
  }).formatToParts(noon);
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-5';
  const match = tz.match(/GMT([+-])(\d+)/);
  if (!match) return '-05:00';
  return `${match[1]}${match[2].padStart(2, '0')}:00`;
}

interface TodoDep {
  id: number;
  title: string;
}

interface Todo {
  id: number;
  title: string;
  createdAt: string;
  dueDate: string | null;
  imageUrl: string | null;
  isCritical: boolean;
  dependencies: TodoDep[];
}

export default function Home() {
  const [newTodo, setNewTodo] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loadingImageIds, setLoadingImageIds] = useState<Set<number>>(new Set());
  const [depError, setDepError] = useState<string | null>(null);

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch('/api/todos');
      const data: Todo[] = await res.json();
      setTodos(data);
      // Clear loading state for todos that now have images
      setLoadingImageIds((prev) => {
        const next = new Set(prev);
        for (const t of data) {
          if (t.imageUrl) next.delete(t.id);
        }
        return next;
      });
    } catch (error) {
      console.error('Failed to fetch todos:', error);
    }
  }, []);

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  // Poll for image updates every 2s while any todo is awaiting an image
  useEffect(() => {
    if (loadingImageIds.size === 0) return;
    const interval = setInterval(fetchTodos, 2000);
    return () => clearInterval(interval);
  }, [loadingImageIds, fetchTodos]);

  const handleAddTodo = async () => {
    if (!newTodo.trim()) return;
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTodo, dueDate: newDueDate ? `${newDueDate}T17:00:00${easternOffset(newDueDate)}` : null }),
      });
      const created: Todo = await res.json();
      setNewTodo('');
      setNewDueDate('');
      // Mark as loading image immediately
      setLoadingImageIds((prev) => new Set(prev).add(created.id));
      fetchTodos();
    } catch (error) {
      console.error('Failed to add todo:', error);
    }
  };

  const handleDeleteTodo = async (id: number) => {
    try {
      await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      fetchTodos();
    } catch (error) {
      console.error('Failed to delete todo:', error);
    }
  };

  const handleAddDependency = async (todoId: number, dependencyId: number) => {
    setDepError(null);
    try {
      const res = await fetch(`/api/todos/${todoId}/dependencies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dependencyId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setDepError(data.error ?? 'Could not add dependency');
        return;
      }
      fetchTodos();
    } catch (error) {
      console.error('Failed to add dependency:', error);
    }
  };

  const handleRemoveDependency = async (todoId: number, depId: number) => {
    try {
      await fetch(`/api/todos/${todoId}/dependencies/${depId}`, { method: 'DELETE' });
      fetchTodos();
    } catch (error) {
      console.error('Failed to remove dependency:', error);
    }
  };

  const handleToggleCritical = async (todo: Todo) => {
    try {
      await fetch(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCritical: !todo.isCritical }),
      });
      fetchTodos();
    } catch (error) {
      console.error('Failed to update critical path:', error);
    }
  };

  const { earliestStart } = computeCriticalPath(
    todos.map((t) => ({ id: t.id, dueDate: t.dueDate, dependencies: t.dependencies }))
  );
  const criticalPath = todos.filter((t) => t.isCritical).map((t) => t.id);

  const isPastDue = (dueDate: string | null) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    });

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-500 to-red-500 flex flex-col items-center p-4 pb-12">
      <div className="w-full max-w-2xl">
        <h1 className="text-4xl font-bold text-center text-white mb-8">Things To Do App</h1>

        {/* Add todo form */}
        <div className="flex flex-col gap-2 mb-6">
          <div className="flex">
            <input
              type="text"
              className="flex-grow p-3 rounded-l-full focus:outline-none text-gray-700"
              placeholder="Add a new todo"
              value={newTodo}
              onChange={(e) => setNewTodo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
            />
            <input
              type="date"
              className="p-3 border-l border-gray-200 text-gray-700 focus:outline-none"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
            />
            <button
              onClick={handleAddTodo}
              className="bg-white text-indigo-600 p-3 rounded-r-full hover:bg-gray-100 transition duration-300 font-semibold"
            >
              Add
            </button>
          </div>
        </div>

        {/* Todo list */}
        <ul className="space-y-4 mb-8">
          {todos.map((todo) => {
            const es = earliestStart.get(todo.id);
            return (
              <li
                key={todo.id}
                className={`bg-white bg-opacity-90 p-4 rounded-xl shadow-lg ${todo.isCritical ? 'ring-2 ring-red-400' : ''}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-800 font-medium">{todo.title}</span>
                      <button
                        onClick={() => handleToggleCritical(todo)}
                        className={`text-xs px-2 py-0.5 rounded-full font-semibold border transition-colors ${
                          todo.isCritical
                            ? 'bg-red-100 text-red-600 border-red-300 hover:bg-red-200'
                            : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {todo.isCritical ? '★ Critical Path' : '☆ Mark Critical'}
                      </button>
                    </div>

                    {/* Due date */}
                    {todo.dueDate && (
                      <p className={`text-sm mt-1 ${isPastDue(todo.dueDate) ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                        Due: {formatDate(todo.dueDate)}
                        {isPastDue(todo.dueDate) && ' ⚠ Overdue'}
                      </p>
                    )}

                    {/* Earliest start */}
                    {es && (
                      <p className="text-sm text-indigo-600 mt-0.5">
                        Earliest start: {formatDate(es.toISOString())}
                      </p>
                    )}

                    {/* Dependencies */}
                    {todo.dependencies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {todo.dependencies.map((dep) => (
                          <span
                            key={dep.id}
                            className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full"
                          >
                            {dep.title}
                            <button
                              onClick={() => handleRemoveDependency(todo.id, dep.id)}
                              className="text-indigo-400 hover:text-indigo-700 leading-none"
                              title="Remove dependency"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Add dependency select */}
                    {todos.filter((t) => t.id !== todo.id).length > 0 && (
                      <select
                        className="mt-2 text-xs text-gray-600 border border-gray-200 rounded px-2 py-1 focus:outline-none"
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddDependency(todo.id, parseInt(e.target.value));
                            e.target.value = '';
                          }
                        }}
                      >
                        <option value="" disabled>+ add dependency…</option>
                        {todos
                          .filter(
                            (t) =>
                              t.id !== todo.id &&
                              !todo.dependencies.some((d) => d.id === t.id)
                          )
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.title}
                            </option>
                          ))}
                      </select>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Image */}
                    {loadingImageIds.has(todo.id) && !todo.imageUrl ? (
                      <div className="w-20 h-16 rounded-lg bg-gray-200 animate-pulse" />
                    ) : todo.imageUrl ? (
                      <img
                        src={todo.imageUrl}
                        alt={todo.title}
                        className="w-20 h-16 object-cover rounded-lg shadow"
                      />
                    ) : null}

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="text-red-500 hover:text-red-700 transition duration-300"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Dependency error */}
        {depError && (
          <div className="mb-4 bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm">
            {depError}
            <button className="ml-2 underline" onClick={() => setDepError(null)}>dismiss</button>
          </div>
        )}

        {/* Dependency graph */}
        {todos.length > 0 && todos.some((t) => t.dependencies.length > 0) && (
          <div className="mt-4">
            <h2 className="text-white font-semibold text-lg mb-2">Dependency Graph</h2>
            <DependencyGraph todos={todos} criticalPath={criticalPath} />
          </div>
        )}
      </div>
    </div>
  );
}
