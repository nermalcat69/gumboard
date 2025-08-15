export interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  timestamp?: string;
  footer?: {
    text: string;
    icon_url?: string;
  };
  author?: {
    name: string;
    icon_url?: string;
  };
  fields?: {
    name: string;
    value: string;
    inline?: boolean;
  }[];
}

export interface DiscordMessage {
  content?: string;
  username?: string;
  avatar_url?: string;
  embeds?: DiscordEmbed[];
}

export function hasValidContent(content: string | null | undefined): boolean {
  if (!content) return false;
  
  const trimmed = content.trim();
  if (!trimmed) return false;
  
  // Check if content contains only special characters
  const specialCharsOnly = /^[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?\s]*$/;
  if (specialCharsOnly.test(trimmed)) return false;
  
  return true;
}

export function shouldSendNotification(
  userId: string,
  boardId: string,
  boardName: string,
  sendDiscordUpdates: boolean
): boolean {
  return sendDiscordUpdates;
}

export function formatTodoForDiscord(
  todoContent: string,
  boardName: string,
  userName: string,
  action: "added" | "completed"
): DiscordMessage {
  const emoji = action === "completed" ? "✅" : "➕";
  const actionText = action === "completed" ? "completed" : "added";
  
  return {
    username: "Gumboard",
    avatar_url: "https://gumboard.com/logo/gumboard.svg",
    embeds: [{
      color: action === "completed" ? 0x00ff00 : 0x0099ff, // Green for completed, blue for added
      description: `${emoji} **${todoContent}**`,
      footer: {
        text: `${actionText} by ${userName} in ${boardName}`
      },
      timestamp: new Date().toISOString()
    }]
  };
}

export function formatNoteForDiscord(
  note: { checklistItems?: Array<{ content: string }> },
  boardName: string,
  userName: string
): DiscordMessage {
  // Get content from first checklist item
  const content =
    note.checklistItems && note.checklistItems.length > 0
      ? note.checklistItems[0].content
      : "New note";
  
  return {
    embeds: [{
      description: `➕ **${content}** added by ${userName} in ${boardName}`,
      color: 0x0099ff,
      timestamp: new Date().toISOString(),
      footer: {
        text: "Gumboard",
      },
    }],
  };
}

export async function sendDiscordMessage(
  webhookUrl: string,
  message: DiscordMessage
): Promise<string | null> {
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error("Failed to send Discord message:", response.statusText);
      return null;
    }

    return Date.now().toString();
  } catch (error) {
    console.error("Error sending Discord message:", error);
    return null;
  }
}

export async function updateDiscordMessage(
  webhookUrl: string,
  originalText: string,
  completed: boolean,
  boardName: string,
  userName: string
): Promise<void> {
  try {
    const emoji = completed ? "✅" : "➕";
    const actionText = completed ? "completed" : "added";
    
    const message: DiscordMessage = {
      username: "Gumboard",
      avatar_url: "https://gumboard.com/logo/gumboard.svg",
      embeds: [{
        color: completed ? 0x00ff00 : 0x0099ff,
        description: `${emoji} **${originalText}**`,
        footer: {
          text: `${actionText} by ${userName} in ${boardName}`
        },
        timestamp: new Date().toISOString()
      }]
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
  } catch (error) {
    console.error("Error updating Discord message:", error);
  }
}

export async function sendTodoNotification(
  webhookUrl: string,
  todoContent: string,
  boardName: string,
  userName: string,
  action: "added" | "completed"
): Promise<string | null> {
  const message = formatTodoForDiscord(todoContent, boardName, userName, action);
  return await sendDiscordMessage(webhookUrl, message);
}