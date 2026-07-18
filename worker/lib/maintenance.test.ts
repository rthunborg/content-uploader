import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getWorkerSql: vi.fn(), verify: vi.fn() }));
vi.mock("./database.ts", () => ({ getWorkerSql: mocks.getWorkerSql }));
vi.mock("../jobs/verify-acceptance-chain.ts", () => ({ runAcceptanceChainVerification: mocks.verify }));
import { consumeOneMaintenanceJob, dispatchMaintenanceJob } from "./maintenance";

beforeEach(() => { mocks.getWorkerSql.mockReset(); mocks.verify.mockReset().mockResolvedValue(true); });
describe("maintenance dispatch", () => {
  it("dispatches the scheduled named job", async () => { const reader = { records: async () => [], head: async () => null }; const sql = vi.fn(); mocks.getWorkerSql.mockReturnValue(sql); await expect(dispatchMaintenanceJob({ v: 1, name: "verify-acceptance-chain" }, reader)).resolves.toBe(true); });
  it("rejects unknown jobs", async () => expect(dispatchMaintenanceJob({ v: 1, name: "other" }, { records: async () => [], head: async () => null })).rejects.toThrow());
  it("reads ledger and head in one repeatable-read snapshot with a valid isolation level", async () => {
    const tx = vi.fn(() => Promise.resolve([]));
    const begin = vi.fn(async (_options: string, fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
    const sql = Object.assign(vi.fn(() => Promise.resolve([])), { begin });
    mocks.getWorkerSql.mockReturnValue(sql);
    let captured: { snapshot?: () => Promise<unknown> } | undefined;
    mocks.verify.mockImplementation(async (reader: typeof captured) => { captured = reader; return true; });
    await dispatchMaintenanceJob({ v: 1, name: "verify-acceptance-chain" });
    await captured!.snapshot!();
    // postgres.js emits `begin <options>`; only "isolation level repeatable read" is valid SQL.
    expect(begin).toHaveBeenCalledWith("isolation level repeatable read", expect.any(Function));
  });
  it("reads, dispatches, and deletes the exact completed message", async () => { const queries: string[] = []; const sql = vi.fn((parts: TemplateStringsArray) => { const query = parts.join("?"); queries.push(query); return Promise.resolve(queries.length === 1 ? [{ msg_id: 42, message: { v: 1, name: "verify-acceptance-chain" } }] : []); }); mocks.getWorkerSql.mockReturnValue(sql); await expect(consumeOneMaintenanceJob()).resolves.toBe(true); expect(mocks.verify).toHaveBeenCalledOnce(); expect(queries[0]).toContain("pgmq.read"); expect(queries[1]).toContain("pgmq.delete"); });
  it("returns false without dispatch or delete for an empty queue", async () => { const sql = vi.fn().mockResolvedValue([]); mocks.getWorkerSql.mockReturnValue(sql); await expect(consumeOneMaintenanceJob()).resolves.toBe(false); expect(mocks.verify).not.toHaveBeenCalled(); expect(sql).toHaveBeenCalledOnce(); });
  it("does not delete when dispatch fails", async () => { const sql = vi.fn().mockResolvedValueOnce([{ msg_id: 9, message: { v: 1, name: "verify-acceptance-chain" } }]); mocks.getWorkerSql.mockReturnValue(sql); mocks.verify.mockRejectedValueOnce(new Error("verification failed")); await expect(consumeOneMaintenanceJob()).rejects.toThrow("verification failed"); expect(sql).toHaveBeenCalledOnce(); });
  it("deletes a terminal integrity-failure message after its critical event is emitted", async () => { const queries: string[] = []; const sql = vi.fn((parts: TemplateStringsArray) => { queries.push(parts.join("?")); return Promise.resolve(queries.length === 1 ? [{ msg_id: 10, message: { v: 1, name: "verify-acceptance-chain" } }] : []); }); mocks.getWorkerSql.mockReturnValue(sql); mocks.verify.mockResolvedValueOnce(false); await expect(consumeOneMaintenanceJob()).resolves.toBe(true); expect(queries[1]).toContain("pgmq.delete"); });
});
