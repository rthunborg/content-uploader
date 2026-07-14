import { describe, expect, it, vi } from "vitest";
import { provisionAdmin } from "./create-admin";

function clientWith(pages: Array<Array<{ id: string; email: string; app_metadata: Record<string, unknown> }>>) {
  const listUsers = vi.fn().mockImplementation(({ page }) => Promise.resolve({ data: { users: pages[page - 1] ?? [] }, error: null }));
  const updateUserById = vi.fn().mockResolvedValue({ error: null });
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn().mockReturnValue({ upsert });
  return { client: { auth: { admin: { listUsers, updateUserById } }, from }, listUsers, updateUserById, from, upsert };
}

describe("admin provisioning", () => {
  it("elevates a non-admin, preserves metadata, and creates the active profile", async () => {
    const fixture = clientWith([[{ id: "u1", email: "Admin@example.com", app_metadata: { tenant: "fleet" } }]]);
    await provisionAdmin("admin@example.com", fixture.client as never);
    expect(fixture.updateUserById).toHaveBeenCalledWith("u1", { app_metadata: { tenant: "fleet", admin: true } });
    expect(fixture.upsert).toHaveBeenCalledWith({ id: "u1", email: "Admin@example.com", account_state: "active" }, { onConflict: "id" });
  });

  it("does not rewrite metadata for an existing admin but still ensures the profile", async () => {
    const fixture = clientWith([[{ id: "u1", email: "admin@example.com", app_metadata: { admin: true } }]]);
    await provisionAdmin("admin@example.com", fixture.client as never);
    expect(fixture.updateUserById).not.toHaveBeenCalled();
    expect(fixture.upsert).toHaveBeenCalledOnce();
  });

  it("paginates across a full page boundary", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({ id: `u${index}`, email: `user${index}@example.com`, app_metadata: {} }));
    const fixture = clientWith([firstPage, [{ id: "target", email: "admin@example.com", app_metadata: {} }]]);
    await provisionAdmin("admin@example.com", fixture.client as never);
    expect(fixture.listUsers).toHaveBeenNthCalledWith(1, { page: 1, perPage: 100 });
    expect(fixture.listUsers).toHaveBeenNthCalledWith(2, { page: 2, perPage: 100 });
  });
});
