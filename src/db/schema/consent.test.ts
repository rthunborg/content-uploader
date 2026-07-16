import { getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { acceptanceChainHead, acceptanceRecords, termsVersions } from "./consent";

describe("consent schema security invariants", () => {
  it("mirrors terms and ledger checks/indexes from the migration", () => {
    expect(getTableConfig(termsVersions).checks.map(({ name }) => name)).toEqual(expect.arrayContaining(["terms_versions_schema_version_check", "terms_versions_sha256_check"]));
    const records = getTableConfig(acceptanceRecords);
    expect(records.checks.map(({ name }) => name)).toEqual(expect.arrayContaining(["acceptance_records_type_check", "acceptance_records_hmac_check", "acceptance_records_chain_position_check", "acceptance_records_shape_check"]));
    expect(records.indexes.map(({ config: { name } }) => name)).toEqual(expect.arrayContaining(["idx_acceptance_records_chain_position", "idx_acceptance_records_one_tombstone", "idx_acceptance_records_user_terms"]));
    expect(getTableColumns(acceptanceRecords).chainPosition.dataType).toBe("bigint");
  });
  it("constrains singleton head position and signatures", () => { expect(getTableConfig(acceptanceChainHead).checks.map(({ name }) => name)).toEqual(expect.arrayContaining(["acceptance_chain_head_singleton_check", "acceptance_chain_head_position_check", "acceptance_chain_head_hmac_check"])); });
});
