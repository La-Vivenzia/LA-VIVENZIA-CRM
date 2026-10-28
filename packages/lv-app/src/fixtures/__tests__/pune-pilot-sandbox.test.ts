import { describe, expect, it } from 'vitest';

import { PILOT_ZONES } from 'src/domain/pilot-zones';
import { VIBE_MAPPINGS, type VibeKey } from 'src/domain/vibe-taxonomy';
import {
  PUNE_PILOT_SANDBOX_IMPORT_KEY,
  PUNE_PILOT_SANDBOX_RECORDS,
  punePilotSandboxCsv,
  punePilotSandboxRows,
} from 'src/fixtures/pune-pilot-sandbox';

// Tests for the Pune Pilot Sandbox dataset fixture (Task 3).
//
// Verifies dataset size, determinism, taxonomy alignment, safety guards,
// fictional identity constraints, and CSV generation.

describe('Pune Pilot Sandbox Dataset Fixture', () => {
  it('contains exactly 12 deterministic fictional records (within 10-15 range)', () => {
    expect(PUNE_PILOT_SANDBOX_RECORDS).toHaveLength(12);
  });

  it('uses a valid, deterministic UUID for PUNE_PILOT_SANDBOX_IMPORT_KEY', () => {
    expect(PUNE_PILOT_SANDBOX_IMPORT_KEY).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it('clearly identifies every record as fictional sandbox data in name', () => {
    for (const record of PUNE_PILOT_SANDBOX_RECORDS) {
      expect(record.name).toContain('[Sandbox]');
    }
  });

  it('uses non-deliverable internal sandbox domains for all emails', () => {
    for (const record of PUNE_PILOT_SANDBOX_RECORDS) {
      expect(record.email).toMatch(/^[a-z0-9._%+-]+@[a-z0-9.-]*sandbox\.lavivenzia\.internal$/);
    }
  });

  it('uses internal sandbox URLs for all websites', () => {
    for (const record of PUNE_PILOT_SANDBOX_RECORDS) {
      expect(record.websiteUrl).toMatch(/^https:\/\/sandbox\.lavivenzia\.internal\//);
    }
  });

  it('uses synthetic test phone numbers (+91 98220 000XX) requiring staging quarantine', () => {
    for (const record of PUNE_PILOT_SANDBOX_RECORDS) {
      expect(record.phone).toMatch(/^\+91 98220 000\d{2}$/);
    }
  });

  it('covers all four canonical Pune Pilot Zones evenly', () => {
    const zonesInDataset = new Set(PUNE_PILOT_SANDBOX_RECORDS.map((r) => r.pilotZone));
    for (const zone of PILOT_ZONES) {
      expect(zonesInDataset.has(zone), `Missing zone ${zone}`).toBe(true);
      const count = PUNE_PILOT_SANDBOX_RECORDS.filter((r) => r.pilotZone === zone).length;
      expect(count).toBe(3); // 3 per zone across 4 zones = 12 total
    }
  });

  it('covers all five curated Pilot Vibes', () => {
    const subcategories = PUNE_PILOT_SANDBOX_RECORDS.map((r) => r.subcategory);
    const vibes: VibeKey[] = [
      'gaming_arcade',
      'brewery_nightlife',
      'work_cafe',
      'luxury_spa',
      'fine_dining',
    ];

    for (const vibe of vibes) {
      const allowed = VIBE_MAPPINGS[vibe].defensibleSubcategories;
      const matched = subcategories.some((sub) => (allowed as readonly string[]).includes(sub));
      expect(matched, `Vibe ${vibe} has no representing records in sandbox`).toBe(true);
    }
  });

  it('provides sequential, non-conflicting row numbers starting at 2', () => {
    const rowNumbers = PUNE_PILOT_SANDBOX_RECORDS.map((r) => r.rowNumber);
    expect(rowNumbers).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it('provides unique emails and websites across all 12 records', () => {
    const emails = PUNE_PILOT_SANDBOX_RECORDS.map((r) => r.email);
    const websites = PUNE_PILOT_SANDBOX_RECORDS.map((r) => r.websiteUrl);
    expect(new Set(emails).size).toBe(12);
    expect(new Set(websites).size).toBe(12);
  });

  it('generates structured rows matching the import API requirements', () => {
    const rows = punePilotSandboxRows();
    expect(rows).toHaveLength(12);

    for (const row of rows) {
      expect(row.rowNumber).toBeGreaterThanOrEqual(2);
      expect(row.fields.name).toBeTruthy();
      expect(row.fields.organisationName).toBeTruthy();
      expect(row.fields.email).toBeTruthy();
      expect(row.fields.phone).toBeTruthy();
      expect(row.fields.websiteUrl).toBeTruthy();
      expect(row.fields.location).toBeTruthy();
      expect(row.fields.pilotZone).toBeTruthy();
      const rec = PUNE_PILOT_SANDBOX_RECORDS.find((r) => r.rowNumber === row.rowNumber);
      expect(row.fields.pilotZone).toBe(rec?.pilotZone);
      expect(row.fields.category).toBeTruthy();
      expect(row.fields.subcategory).toBeTruthy();
      expect(row.fields.priority).toBeTruthy();
      expect(row.fields.source).toBe('IMPORTED');
    }
  });

  it('generates valid CSV text conforming to import column headers including Pilot Zone', () => {
    const csv = punePilotSandboxCsv();
    const lines = csv.trim().split('\n');
    expect(lines).toHaveLength(13); // 1 header + 12 rows

    const header = lines[0];
    expect(header).toContain('Name');
    expect(header).toContain('Organisation');
    expect(header).toContain('Email');
    expect(header).toContain('Location');
    expect(header).toContain('Pilot Zone');
    expect(header).toContain('Category');
    expect(header).toContain('Subcategory');

    for (let i = 1; i <= 12; i++) {
      expect(lines[i]).toContain('[Sandbox]');
      expect(lines[i]).toContain('sandbox.lavivenzia.internal');
    }
  });
});
