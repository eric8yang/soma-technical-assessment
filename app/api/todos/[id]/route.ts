import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
  params: {
    id: string;
  };
}

export async function PATCH(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  try {
    const { isCritical } = await request.json();
    const todo = await prisma.todo.update({
      where: { id },
      data: { isCritical },
    });
    return NextResponse.json(todo);
  } catch (error) {
    console.error('PATCH /api/todos/[id] error:', error);
    return NextResponse.json({ error: 'Error updating todo' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }
  try {
    await prisma.todo.delete({ where: { id } });
    return NextResponse.json({ message: 'Todo deleted' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error deleting todo' }, { status: 500 });
  }
}
