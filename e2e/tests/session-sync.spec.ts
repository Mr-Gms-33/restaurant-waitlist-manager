import { expect, test } from "@playwright/test";

/**
 * Mapping to this repository's product:
 * - "interviewer session" => staff dashboard browser session
 * - "candidate session" => guest status-page browser session
 * - "canvas change" => guest status update ("I'm here") propagated live to staff
 */
test("staff and guest sessions stay in sync across clients", async ({ browser, request, baseURL }) => {
  if (!baseURL) throw new Error("Playwright baseURL is not configured.");

  // Session 1: interviewer/staff logs in.
  const staffContext = await browser.newContext();
  const staffPage = await staffContext.newPage();
  await staffPage.goto(`${baseURL}/staff/login`);
  await staffPage.getByLabel("Username").fill("staff");
  await staffPage.getByLabel("Password").fill("waitlist123");
  await staffPage.getByRole("button", { name: "Sign in" }).click();
  await expect(staffPage.getByRole("heading", { name: "Staff dashboard" })).toBeVisible();

  // Step 2 + 3 analogue: create a "session" and produce/share join link.
  const partyName = `Candidate ${Date.now()}`;
  const joinResponse = await request.post(`${baseURL}/api/v1/parties`, {
    data: {
      name: partyName,
      partySize: 2,
      contact: "555-4444",
    },
  });
  expect(joinResponse.status()).toBe(201);
  const party = (await joinResponse.json()) as { id: string };
  const joinLink = `${baseURL}/status/${party.id}`;

  // Step 4: candidate joins from separate session.
  const candidateContext = await browser.newContext();
  const candidatePage = await candidateContext.newPage();
  await candidatePage.goto(joinLink);
  await expect(candidatePage.getByRole("heading", { name: /Hi/ })).toBeVisible();

  // Staff should see the created session/party.
  await expect(staffPage.getByRole("cell", { name: partyName })).toBeVisible();

  // Step 5: candidate changes the "canvas" (status mutation).
  await candidatePage.getByRole("button", { name: "I'm here" }).click();

  // Step 6: interviewer sees the change in session 1.
  // The "Arrived" column flips from em dash to check mark for that party.
  const partyRow = staffPage.locator("tr", { hasText: partyName });
  await expect(partyRow).toContainText("✅");

  await candidateContext.close();
  await staffContext.close();
});
