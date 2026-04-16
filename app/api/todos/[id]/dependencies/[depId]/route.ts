import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

interface Params {
  params: { id: string; depId: string };
}

export async function DELETE(request: Request, { params }: Params) {
  const todoId = parseInt(params.id);
  const depId = parseInt(params.depId);

  if (isNaN(todoId) || isNaN(depId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
  }

  try {
    await prisma.todo.update({
      where: { id: todoId },
      data: { dependencies: { disconnect: { id: depId } } },
    });
    return NextResponse.json({ message: 'Dependency removed' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: 'Error removing dependency' }, { status: 500 });
  }
}
