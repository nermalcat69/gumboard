import {
  hasValidContent,
  shouldSendNotification,
  formatTodoForDiscord,
  formatNoteForDiscord,
  sendDiscordMessage,
  updateDiscordMessage,
  sendTodoNotification,
} from "../discord";

// Mock fetch globally
global.fetch = jest.fn();

describe("Discord utility functions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: "mock-message-id" }),
    });
  });

  describe("hasValidContent", () => {
    it("should return true for valid content", () => {
      expect(hasValidContent("Valid content")).toBe(true);
      expect(hasValidContent("   Valid content   ")).toBe(true);
    });

    it("should return false for invalid content", () => {
      expect(hasValidContent("")).toBe(false);
      expect(hasValidContent("   ")).toBe(false);
      expect(hasValidContent(null)).toBe(false);
      expect(hasValidContent(undefined)).toBe(false);
    });
  });

  describe("shouldSendNotification", () => {
    it("should return false for test boards", () => {
      expect(shouldSendNotification("user1", "board1", "Test Board", true)).toBe(false);
    });

    it("should return false when Discord updates are disabled", () => {
      expect(shouldSendNotification("user1", "board1", "Regular Board", false)).toBe(false);
    });

    it("should return true for valid notifications", () => {
      expect(shouldSendNotification("user1", "board1", "Regular Board", true)).toBe(true);
    });
  });

  describe("formatTodoForDiscord", () => {
    it("should format added todo correctly", () => {
      const result = formatTodoForDiscord("Test todo", "Test Board", "John Doe", "added");
      expect(result.embeds?.[0]?.description).toBe("➕ **Test todo** added by John Doe in Test Board");
      expect(result.embeds?.[0]?.color).toBe(0x0099ff);
    });

    it("should format completed todo correctly", () => {
      const result = formatTodoForDiscord("Test todo", "Test Board", "John Doe", "completed");
      expect(result.embeds?.[0]?.description).toBe("✅ **Test todo** completed by John Doe in Test Board");
      expect(result.embeds?.[0]?.color).toBe(0x00ff00);
    });
  });

  describe("formatNoteForDiscord", () => {
    it("should format note with checklist items", () => {
      const note = {
        checklistItems: [{ content: "First item" }, { content: "Second item" }],
      };
      const result = formatNoteForDiscord(note, "Test Board", "John Doe");
      expect(result.embeds?.[0]?.description).toBe("➕ **First item** added by John Doe in Test Board");
    });

    it("should format note without checklist items", () => {
      const note = { checklistItems: [] };
      const result = formatNoteForDiscord(note, "Test Board", "John Doe");
      expect(result.embeds?.[0]?.description).toBe("➕ **New note** added by John Doe in Test Board");
    });
  });

  describe("sendDiscordMessage", () => {
    it("should send Discord message successfully", async () => {
      const webhookUrl = "https://discord.com/api/webhooks/123/abc";
      const message = {
        embeds: [{
          description: "Test message",
          color: 0x0099ff,
        }],
      };

      const result = await sendDiscordMessage(webhookUrl, message);

      expect(fetch).toHaveBeenCalledWith(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      });
      expect(result).toBe("mock-message-id");
    });

    it("should handle Discord API errors", async () => {
      (fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
      });

      const result = await sendDiscordMessage("https://discord.com/api/webhooks/123/abc", {
        embeds: [{ description: "Test" }],
      });

      expect(result).toBeNull();
    });
  });

  describe("updateDiscordMessage", () => {
    it("should update Discord message for completed todo", async () => {
      await updateDiscordMessage(
        "https://discord.com/api/webhooks/123/abc",
        "Test todo",
        true,
        "Test Board",
        "John Doe"
      );

      expect(fetch).toHaveBeenCalledWith(
        "https://discord.com/api/webhooks/123/abc",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: expect.stringContaining("✅ **Test todo** completed by John Doe in Test Board"),
        })
      );
    });

    it("should update Discord message for added todo", async () => {
      await updateDiscordMessage(
        "https://discord.com/api/webhooks/123/abc",
        "Test todo",
        false,
        "Test Board",
        "John Doe"
      );

      expect(fetch).toHaveBeenCalledWith(
        "https://discord.com/api/webhooks/123/abc",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: expect.stringContaining("➕ **Test todo** added by John Doe in Test Board"),
        })
      );
    });
  });

  describe("sendTodoNotification", () => {
    it("should send todo notification", async () => {
      const result = await sendTodoNotification(
        "https://discord.com/api/webhooks/123/abc",
        "Test todo",
        "Test Board",
        "John Doe",
        "added"
      );

      expect(fetch).toHaveBeenCalled();
      expect(result).toBe("mock-message-id");
    });
  });
});