import { test, expect } from "../fixtures/test-helpers";

test.describe("Discord Integration", () => {
  test("should display Discord webhook URL input in organization settings", async ({
    authenticatedPage,
    testContext,
  }) => {
    await authenticatedPage.goto("/settings/organization");

    await expect(authenticatedPage.locator("text=Discord Integration")).toBeVisible();
    await expect(authenticatedPage.locator('label:has-text("Discord Webhook URL")')).toBeVisible();
    
    const discordInput = authenticatedPage.locator("#discordWebhookUrl");
    await expect(discordInput).toBeVisible();
    await expect(discordInput).toHaveAttribute("type", "url");
    await expect(discordInput).toHaveAttribute("placeholder", "https://discord.com/api/webhooks/...");
  });

  test("should save Discord webhook URL", async ({
    authenticatedPage,
    testContext,
    testPrisma,
  }) => {
    const discordWebhookUrl = "https://discord.com/api/webhooks/123456789/abcdefghijklmnop";

    await authenticatedPage.goto("/settings/organization");

    const discordInput = authenticatedPage.locator("#discordWebhookUrl");
    await discordInput.fill(discordWebhookUrl);

    await authenticatedPage.click('button:has-text("Save Changes")');

    // Wait for the save request to complete
    const saveResponse = authenticatedPage.waitForResponse(
      (resp) =>
        resp.url().includes("/api/organization") &&
        resp.request().method() === "PUT" &&
        resp.ok()
    );
    await saveResponse;

    // Verify in database
    const organization = await testPrisma.organization.findUnique({
      where: { id: testContext.organizationId },
    });
    expect(organization?.discordWebhookUrl).toBe(discordWebhookUrl);

    // Verify the input still shows the saved value
    await expect(discordInput).toHaveValue(discordWebhookUrl);
  });

  test("should display Discord updates checkbox in board settings", async ({
    authenticatedPage,
    testContext,
    testPrisma,
  }) => {
    // Create a board with Discord updates enabled
    const board = await testPrisma.board.create({
      data: {
        name: testContext.getBoardName("Discord Test Board"),
        description: testContext.prefix("A test board for Discord"),
        sendDiscordUpdates: true,
        createdBy: testContext.userId,
        organizationId: testContext.organizationId,
      },
    });

    await authenticatedPage.goto(`/boards/${board.id}`);

    await authenticatedPage.click(`button:has(div:has-text("${board.name}"))`);
    await authenticatedPage.click('button:has-text("Board settings")');

    await expect(authenticatedPage.locator("text=Board settings")).toBeVisible();
    await expect(
      authenticatedPage.locator('label:has-text("Send updates to Discord")')
    ).toBeVisible();

    const checkbox = authenticatedPage.locator("#sendDiscordUpdates");
    await expect(checkbox).toBeVisible();
    await expect(checkbox).toBeChecked();
  });

  test("should toggle Discord updates setting and save changes", async ({
    authenticatedPage,
    testContext,
    testPrisma,
  }) => {
    // Create a board with Discord updates enabled
    const board = await testPrisma.board.create({
      data: {
        name: testContext.getBoardName("Discord Test Board"),
        description: testContext.prefix("A test board for Discord"),
        sendDiscordUpdates: true,
        createdBy: testContext.userId,
        organizationId: testContext.organizationId,
      },
    });

    await authenticatedPage.goto(`/boards/${board.id}`);

    await authenticatedPage.click(`button:has(div:has-text("${board.name}"))`);
    await authenticatedPage.click('button:has-text("Board settings")');

    const checkbox = authenticatedPage.locator("#sendDiscordUpdates");
    await expect(checkbox).toBeChecked();

    await checkbox.uncheck();
    await expect(checkbox).not.toBeChecked();

    await authenticatedPage.click('button:has-text("Save settings")');

    const saveSettingsResponse = authenticatedPage.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/boards/${board.id}`) &&
        resp.request().method() === "PUT" &&
        resp.ok()
    );
    await saveSettingsResponse;

    // Verify in database
    const updatedBoard = await testPrisma.board.findUnique({
      where: { id: board.id },
    });
    expect(updatedBoard?.sendDiscordUpdates).toBe(false);

    await expect(authenticatedPage.locator("text=Board settings")).not.toBeVisible();
  });

  test("should respect Discord updates setting when creating notes", async ({
    authenticatedPage,
    testContext,
    testPrisma,
  }) => {
    // Set up Discord webhook URL for the organization
    await testPrisma.organization.update({
      where: { id: testContext.organizationId },
      data: { discordWebhookUrl: "https://discord.com/api/webhooks/123456789/abcdefghijklmnop" },
    });

    // Create a board with Discord updates disabled
    const board = await testPrisma.board.create({
      data: {
        name: testContext.getBoardName("Discord Test Board"),
        description: testContext.prefix("A test board for Discord"),
        sendDiscordUpdates: false,
        createdBy: testContext.userId,
        organizationId: testContext.organizationId,
      },
    });

    // Mock Discord webhook to detect if notifications are sent
    let discordNotificationSent = false;
    await authenticatedPage.route("https://discord.com/api/webhooks/**", async (route) => {
      discordNotificationSent = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "mock-message-id" }),
      });
    });

    await authenticatedPage.goto(`/boards/${board.id}`);

    await authenticatedPage.click('button:has-text("Add Note")');
    const createNoteResponse = authenticatedPage.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/boards/${board.id}/notes`) &&
        resp.request().method() === "POST" &&
        resp.status() === 201
    );
    await createNoteResponse;

    // Verify note was created in database
    const notes = await testPrisma.note.findMany({
      where: { boardId: board.id },
    });
    expect(notes).toHaveLength(1);

    // Verify no Discord notification was sent (since sendDiscordUpdates is false)
    expect(discordNotificationSent).toBe(false);
  });

  test("should send Discord notification when Discord updates are enabled", async ({
    authenticatedPage,
    testContext,
    testPrisma,
  }) => {
    // Set up Discord webhook URL for the organization
    await testPrisma.organization.update({
      where: { id: testContext.organizationId },
      data: { discordWebhookUrl: "https://discord.com/api/webhooks/123456789/abcdefghijklmnop" },
    });

    // Create a board with Discord updates enabled
    const board = await testPrisma.board.create({
      data: {
        name: testContext.getBoardName("Discord Test Board"),
        description: testContext.prefix("A test board for Discord"),
        sendDiscordUpdates: true,
        createdBy: testContext.userId,
        organizationId: testContext.organizationId,
      },
    });

    // Mock Discord webhook to detect if notifications are sent
    let discordNotificationSent = false;
    let discordPayload: any = null;
    await authenticatedPage.route("https://discord.com/api/webhooks/**", async (route) => {
      discordNotificationSent = true;
      discordPayload = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: "mock-message-id" }),
      });
    });

    await authenticatedPage.goto(`/boards/${board.id}`);

    await authenticatedPage.click('button:has-text("Add Note")');
    
    // Add content to the note
    const noteInput = authenticatedPage.locator('textarea[placeholder="Add a task..."]').first();
    await noteInput.fill("Test Discord notification");
    await noteInput.press("Enter");

    // Wait for the note creation to complete
    await authenticatedPage.waitForTimeout(1000);

    // Verify Discord notification was sent
    expect(discordNotificationSent).toBe(true);
    expect(discordPayload?.embeds?.[0]?.description).toContain("Test Discord notification");
    expect(discordPayload?.embeds?.[0]?.description).toContain(board.name);
  });
});