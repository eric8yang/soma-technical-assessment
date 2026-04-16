import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const todos = await prisma.todo.findMany({
      orderBy: { createdAt: 'desc' },
      include: { dependencies: { select: { id: true, title: true } } },
    });
    return NextResponse.json(todos);
  } catch (error) {
    return NextResponse.json({ error: 'Error fetching todos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { title, dueDate } = await request.json();
    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const todo = await prisma.todo.create({
      data: {
        title,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
      include: { dependencies: { select: { id: true, title: true } } },
    });

    // Fetch image from Pexels in the background and update the record
    const apiKey = process.env.PEXELS_API_KEY;
    if (apiKey) {
      fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(title)}&per_page=1`, {
        headers: { Authorization: apiKey },
      })
        .then((res) => res.json())
        .then(async (data) => {
          const imageUrl = data?.photos?.[0]?.src?.medium;
          if (imageUrl) {
            await prisma.todo.update({
              where: { id: todo.id },
              data: { imageUrl },
            });
          }
        })
        .catch(() => {});
    }

    return NextResponse.json(todo, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Error creating todo' }, { status: 500 });
  }
}
