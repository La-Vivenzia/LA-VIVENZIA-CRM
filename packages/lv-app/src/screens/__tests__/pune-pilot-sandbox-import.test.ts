// @vitest-environment happy-dom
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as client from 'src/api/client';
import { useImport, type ImportState } from 'src/api/import';
import { themeFor } from 'src/design/theme';
import {
  PUNE_PILOT_SANDBOX_IMPORT_KEY,
  PUNE_PILOT_SANDBOX_RECORDS,
} from 'src/fixtures/pune-pilot-sandbox';
import { SelectStep } from 'src/screens/import/steps';

// Tests for the "Load Pune Pilot Sandbox" import feature (Task 3).
//
// Verifies hook lifecycle, loading states, repeat-click protection,
// idempotency via deterministic import key, error recovery, and result mapping.

describe('useImport: Pune Pilot Sandbox Workflow', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('initializes with sandbox loading set to false', () => {
    const { result } = renderHook(() => useImport());
    expect(result.current.isSandboxLoading).toBe(false);
    expect(result.current.phase).toBe('SELECT');
    expect(result.current.error).toBeNull();
  });

  it('submits all 12 sandbox records to /capture/import/commit with deterministic key and CREATE decisions', async () => {
    const mockCallRoute = vi.spyOn(client, 'callRoute').mockResolvedValueOnce({
      report: PUNE_PILOT_SANDBOX_RECORDS.map((r) => ({
        rowNumber: r.rowNumber,
        status: 'CREATED',
        leadId: `lead-${r.rowNumber}`,
        lvLeadId: `LV-00000${r.rowNumber}`,
        error: null,
        ownerApplied: false,
      })),
      summary: {
        total: 12,
        created: 12,
        skipped: 0,
        existing: 0,
        errors: 0,
        ownerWarnings: 0,
      },
      note: null,
    });

    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.loadSandbox();
    });

    expect(mockCallRoute).toHaveBeenCalledTimes(1);
    const [path, body] = mockCallRoute.mock.calls[0] as [string, Record<string, unknown>];
    expect(path).toBe('/capture/import/commit');
    expect(body.importKey).toBe(PUNE_PILOT_SANDBOX_IMPORT_KEY);

    const rows = body.rows as { rowNumber: number; decision: string; fields: Record<string, string> }[];
    expect(rows).toHaveLength(12);
    for (const row of rows) {
      expect(row.decision).toBe('CREATE');
      expect(row.fields.name).toContain('[Sandbox]');
      expect(row.fields.pilotZone).toBeTruthy();
    }

    // Verifies result state
    expect(result.current.phase).toBe('RESULT');
    expect(result.current.fileName).toBe('Pune Pilot Sandbox');
    expect(result.current.isSandboxLoading).toBe(false);
    expect(result.current.reportSummary).toEqual({
      total: 12,
      created: 12,
      skipped: 0,
      existing: 0,
      errors: 0,
      ownerWarnings: 0,
    });
    expect(result.current.report).toHaveLength(12);
  });

  it('handles repeat load idempotently when server reports records already exist', async () => {
    vi.spyOn(client, 'callRoute').mockResolvedValueOnce({
      report: PUNE_PILOT_SANDBOX_RECORDS.map((r) => ({
        rowNumber: r.rowNumber,
        status: 'EXISTS',
        leadId: `lead-${r.rowNumber}`,
        lvLeadId: `LV-00000${r.rowNumber}`,
        error: null,
        ownerApplied: false,
      })),
      summary: {
        total: 12,
        created: 0,
        skipped: 0,
        existing: 12,
        errors: 0,
        ownerWarnings: 0,
      },
      note: null,
    });

    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.loadSandbox();
    });

    expect(result.current.phase).toBe('RESULT');
    expect(result.current.reportSummary?.created).toBe(0);
    expect(result.current.reportSummary?.existing).toBe(12);
  });

  it('guards against rapid repeated clicks while a load is in progress', async () => {
    let resolveCall: ((value: unknown) => void) | null = null;
    const delayedPromise = new Promise((resolve) => {
      resolveCall = resolve;
    });

    const mockCallRoute = vi.spyOn(client, 'callRoute').mockImplementation(() => delayedPromise as Promise<unknown>);

    const { result } = renderHook(() => useImport());

    // First click: triggers load
    let firstCallPromise: Promise<void>;
    act(() => {
      firstCallPromise = result.current.loadSandbox();
    });

    expect(result.current.isSandboxLoading).toBe(true);
    expect(result.current.phase).toBe('IMPORTING');
    expect(mockCallRoute).toHaveBeenCalledTimes(1);

    // Second click while in-flight: should be ignored
    await act(async () => {
      await result.current.loadSandbox();
    });

    expect(mockCallRoute).toHaveBeenCalledTimes(1);

    // Resolve the initial call
    await act(async () => {
      resolveCall?.({
        report: [],
        summary: { total: 12, created: 12, skipped: 0, existing: 0, errors: 0, ownerWarnings: 0 },
      });
      await firstCallPromise!;
    });

    expect(result.current.isSandboxLoading).toBe(false);
    expect(result.current.phase).toBe('RESULT');
  });

  it('safely catches API rejection, sets error, and restores phase to SELECT for retry', async () => {
    vi.spyOn(client, 'callRoute').mockRejectedValueOnce(new Error('Network failure: Unable to reach CRM API'));

    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.loadSandbox();
    });

    expect(result.current.phase).toBe('SELECT');
    expect(result.current.isSandboxLoading).toBe(false);
    expect(result.current.error).toBe('Network failure: Unable to reach CRM API');

    // Dismiss error clears the message
    act(() => {
      result.current.dismissError();
    });
    expect(result.current.error).toBeNull();
  });

  it('resets all state cleanly on reset()', async () => {
    vi.spyOn(client, 'callRoute').mockResolvedValueOnce({
      report: [],
      summary: { total: 12, created: 12, skipped: 0, existing: 0, errors: 0, ownerWarnings: 0 },
    });

    const { result } = renderHook(() => useImport());

    await act(async () => {
      await result.current.loadSandbox();
    });
    expect(result.current.phase).toBe('RESULT');

    act(() => {
      result.current.reset();
    });

    expect(result.current.phase).toBe('SELECT');
    expect(result.current.fileName).toBeNull();
    expect(result.current.report).toEqual([]);
    expect(result.current.reportSummary).toBeNull();
    expect(result.current.isSandboxLoading).toBe(false);
  });
});

describe('SelectStep UI: Pune Pilot Sandbox Controls', () => {
  const theme = themeFor('light');

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock');
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  const makeMockState = (overrides: Partial<ImportState> = {}): ImportState => ({
    importKey: 'test-key',
    phase: 'SELECT',
    error: null,
    isSandboxLoading: false,
    fileName: null,
    fileSize: null,
    uploadFraction: null,
    headers: [],
    sample: [],
    rowCount: 0,
    skippedEmptyRows: 0,
    truncated: false,
    mapping: {},
    mappedTargets: [],
    rows: [],
    summary: null,
    duplicateError: null,
    members: [],
    decisions: {},
    report: [],
    reportSummary: null,
    note: null,
    willCreate: 0,
    problems: [],
    setPhase: vi.fn(),
    selectFile: vi.fn(),
    setColumn: vi.fn(),
    validate: vi.fn(),
    decide: vi.fn(),
    decideAll: vi.fn(),
    commit: vi.fn(),
    loadSandbox: vi.fn(),
    reset: vi.fn(),
    dismissError: vi.fn(),
    ...overrides,
  });

  it('renders the Pune Pilot Sandbox card with action button and fictional demo notice', () => {
    const state = makeMockState();
    const { getByText } = render(createElement(SelectStep, { theme, state }));

    expect(getByText('Pune Pilot Sandbox')).toBeTruthy();
    expect(getByText('Load Pune Pilot Sandbox')).toBeTruthy();
    expect(getByText('Download Sandbox CSV')).toBeTruthy();
    expect(getByText(/Fictional demo data only:/i)).toBeTruthy();
  });

  it('invokes loadSandbox when Load Pune Pilot Sandbox button is clicked', () => {
    const loadSandboxMock = vi.fn();
    const state = makeMockState({ loadSandbox: loadSandboxMock });
    const { getByRole } = render(createElement(SelectStep, { theme, state }));

    const loadButton = getByRole('button', { name: /Load Pune Pilot Sandbox/i });
    fireEvent.click(loadButton);

    expect(loadSandboxMock).toHaveBeenCalledTimes(1);
  });

  it('disables the button and shows loading state while isSandboxLoading is true', () => {
    const loadSandboxMock = vi.fn();
    const state = makeMockState({ isSandboxLoading: true, loadSandbox: loadSandboxMock });
    const { getByRole } = render(createElement(SelectStep, { theme, state }));

    const loadingButton = getByRole('button', { name: /Loading sandbox leads…/i }) as HTMLButtonElement;
    expect(loadingButton).toBeTruthy();
    expect(loadingButton.disabled).toBe(true);

    fireEvent.click(loadingButton);
    expect(loadSandboxMock).not.toHaveBeenCalled();
  });

  it('triggers CSV download without crashing when Download Sandbox CSV is clicked', () => {
    const state = makeMockState();
    const { getByRole } = render(createElement(SelectStep, { theme, state }));

    const downloadButton = getByRole('button', { name: /Download Sandbox CSV/i });
    expect(() => fireEvent.click(downloadButton)).not.toThrow();
  });

  it('renders disclosure that lists the 12 sandbox venues and their zones when opened', () => {
    const state = makeMockState();
    const { getByText } = render(createElement(SelectStep, { theme, state }));

    const disclosureTrigger = getByText('View the 12 sandbox venues');
    expect(disclosureTrigger).toBeTruthy();

    // Click to expand disclosure
    fireEvent.click(disclosureTrigger);

    expect(getByText('Neon Byte Arcade [Sandbox]')).toBeTruthy();
    expect(getByText('The Saffron Table Fine Dining [Sandbox]')).toBeTruthy();
    expect(getByText('The Hoppy Fox Craft Brewery [Sandbox]')).toBeTruthy();
    expect(getByText('Hadapsar Taproom & Social [Sandbox]')).toBeTruthy();
  });

  it('preserves existing file upload dropzone and column disclosure', () => {
    const state = makeMockState();
    const { getByText } = render(createElement(SelectStep, { theme, state }));

    expect(getByText('Choose the file')).toBeTruthy();
    expect(getByText('Drop a spreadsheet here, or choose one')).toBeTruthy();
    expect(getByText('What the file can hold')).toBeTruthy();

    // Click to expand disclosure
    fireEvent.click(getByText('What the file can hold'));
    expect(getByText('Download a blank template')).toBeTruthy();
  });
});
