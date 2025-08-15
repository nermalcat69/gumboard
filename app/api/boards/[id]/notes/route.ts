import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  sendSlackMessage,
  formatNoteForSlack,
  hasValidContent,
  shouldSendNotification,
} from "@/lib/slack";
import {
  sendDiscordMessage,
  formatNoteForDiscord,
  hasValidContent as hasValidDiscordContent,
  shouldSendNotification as shouldSendDiscordNotification,
} from "@/lib/discord";
import { NOTE_COLORS } from "@/lib/constants";

// Get all notes for a board with pagination
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    const boardId = (await params).id;
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50); // Max 50 notes per request
    const offset = parseInt(searchParams.get('offset') || '0');

    const board = await db.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        isPublic: true,
        organizationId: true,
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    // Check access permissions
    if (!board.isPublic) {
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: {
          organizationId: true,
        },
      });

      if (!user?.organizationId) {
        return NextResponse.json({ error: "No organization found" }, { status: 403 });
      }

      if (board.organizationId !== user.organizationId) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Get paginated notes
    const [notes, totalCount] = await Promise.all([
      db.note.findMany({
        where: {
          boardId: boardId,
          deletedAt: null,
          archivedAt: null,
        },
        select: {
          id: true,
          color: true,
          boardId: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          archivedAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          checklistItems: { orderBy: { order: "asc" } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.note.count({
        where: {
          boardId: boardId,
          deletedAt: null,
          archivedAt: null,
        },
      }),
    ]);

    const hasMore = offset + limit < totalCount;
    const nextOffset = hasMore ? offset + limit : null;

    return NextResponse.json({ 
      notes,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore,
        nextOffset,
      }
    });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Create a new note
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { color, checklistItems } = await request.json();
    const boardId = (await params).id;

    // Verify user has access to this board (same organization)
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        organizationId: true,
        organization: {
          select: {
            slackWebhookUrl: true,
            discordWebhookUrl: true,
          },
        },
        name: true,
        email: true,
      },
    });

    if (!user?.organizationId) {
      return NextResponse.json({ error: "No organization found" }, { status: 403 });
    }

    const board = await db.board.findUnique({
      where: { id: boardId },
      select: {
        id: true,
        name: true,
        organizationId: true,
        sendSlackUpdates: true,
        sendDiscordUpdates: true,
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    if (board.organizationId !== user.organizationId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const randomColor = color || NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];

    // Process checklist items
    const initialChecklistItems: Array<{
      content: string;
      checked: boolean;
      order: number;
    }> = [];
    if (checklistItems && Array.isArray(checklistItems)) {
      checklistItems.forEach((item, index) => {
        initialChecklistItems.push({
          content: item.content || "",
          checked: item.checked || false,
          order: item.order !== undefined ? item.order : index,
        });
      });
    }

    const note = await db.note.create({
      data: {
        color: randomColor,
        boardId,
        createdBy: session.user.id,
        checklistItems:
          initialChecklistItems.length > 0
            ? {
                create: initialChecklistItems,
              }
            : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        checklistItems: { orderBy: { order: "asc" } },
      },
    });

    // Send notifications if note has checklist items with content
    const noteWithItems = note as typeof note & { checklistItems?: Array<{ content: string }> };
    const hasContent =
      noteWithItems.checklistItems &&
      noteWithItems.checklistItems.length > 0 &&
      noteWithItems.checklistItems.some((item: { content: string }) => hasValidContent(item.content));

    // Send Slack notification
    if (
      user.organization?.slackWebhookUrl &&
      hasContent &&
      shouldSendNotification(session.user.id, boardId, board.name, board.sendSlackUpdates)
    ) {
      const slackMessage = formatNoteForSlack(noteWithItems, board.name, user.name || user.email);
      const messageId = await sendSlackMessage(user.organization.slackWebhookUrl, {
        text: slackMessage,
        username: "Gumboard",
        icon_emoji: ":clipboard:",
      });

      if (messageId) {
        await db.note.update({
          where: { id: note.id },
          data: { slackMessageId: messageId },
        });
      }
    }

    // Send Discord notification
    if (
      user.organization?.discordWebhookUrl &&
      hasContent &&
      shouldSendDiscordNotification(session.user.id, boardId, board.name, board.sendDiscordUpdates)
    ) {
      const discordMessage = formatNoteForDiscord(noteWithItems, board.name, user.name || user.email);
      const messageId = await sendDiscordMessage(user.organization.discordWebhookUrl, discordMessage);

      if (messageId) {
        await db.note.update({
          where: { id: note.id },
          data: { discordMessageId: messageId },
        });
      }
    }

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Error creating note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
