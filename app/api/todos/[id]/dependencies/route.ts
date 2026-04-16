import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasCycle } from '@/lib/graph';

interface Params {
  params: { id: string };
}

export async function POST(request: Request, { params }: Params) {
  const todoId = parseInt(params.id);
  const { dependencyId } = await request.json();
  const depId = parseInt(dependencyId);

  if (isNaN(todoId) || isNaN(depId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  if (todoId === depId) {
    return NextResponse.json({ error: 'A task cannot depend on itself' }, { status: 409 });
  }

  try {
    const todos = await prisma.todo.findMany({
      include: { dependencies: { select: { id: true } } },
    });

    if (hasCycle(todos, todoId, depId)) {
      return NextResponse.json({ error: 'Circular dependency detected' }, { status: 409 });
    }

    await prisma.todo.update({
      where: { id: todoId },
      data: { dependencies: { connect: { id: depId } } },
    });

    return NextResponse.json({ message: 'Dependency added' }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error adding dependency' }, { status: 500 });
  }
}
