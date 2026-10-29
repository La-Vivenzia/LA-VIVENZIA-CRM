import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { handler } from 'src/modules/lv-capture/capture-import-commit.logic-function';
import * as callerContext from 'src/modules/lv-dashboard/services/caller-context';
import * as captureImport from 'src/modules/lv-capture/capture-import.logic-function';
import * as captureService from 'src/modules/lv-capture/services/capture-service';
import { assertOutboundTelephonyAllowed, isSandboxLead } from 'src/modules/lv-core/utils/sandbox-telephony-guard';

vi.mock('twenty-client-sdk/core', () => {
  return {
    CoreApiClient: class {
      query = vi.fn().mockResolvedValue({ data: {} });
    },
  };
});

vi.mock('src/modules/lv-capture/capture-import.logic-function', () => ({
  listMembers: vi.fn().mockResolvedValue([]),
  resolveImportRows: vi.fn(),
}));

vi.mock('src/modules/lv-dashboard/services/caller-context', () => ({
  resolveCaller: vi.fn(),
}));

vi.mock('src/modules/lv-dashboard/services/graphql-client', () => ({
  DelegatedGraphqlClient: class {
    query = vi.fn().mockResolvedValue({ data: {} });
  },
}));

vi.mock('src/modules/lv-capture/services/capture-service', () => ({
  createCapturedLead: vi.fn().mockResolvedValue({ ok: true, leadId: 'lead-1', lvLeadId: 'LV-100', replayed: false }),
  findLeadByCaptureKey: vi.fn().mockResolvedValue(null),
  notifyOwnerAssignedAtCapture: vi.fn().mockResolvedValue(true),
}));

describe('capture-import-commit: production sandbox isolation guard', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalLvEnv = process.env.LV_ENVIRONMENT;
  const originalStage = process.env.STAGE;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.LV_ENVIRONMENT;
    delete process.env.STAGE;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalLvEnv !== undefined) {
      process.env.LV_ENVIRONMENT = originalLvEnv;
    } else {
      delete process.env.LV_ENVIRONMENT;
    }
    if (originalStage !== undefined) {
      process.env.STAGE = originalStage;
    } else {
      delete process.env.STAGE;
    }
  });

  const sandboxEvent = {
    userWorkspaceId: 'workspace-1',
    workspaceMemberId: 'member-user',
    body: {
      mode: 'SANDBOX',
      importKey: '7f9c2d18-3a81-4b72-9b04-8e1c64df3310',
      rows: [
        {
          rowNumber: 2,
          decision: 'CREATE',
          fields: {
            name: 'Neon Byte Arcade [Sandbox]',
            email: 'contact@neonbyte.sandbox.lavivenzia.internal',
          },
        },
      ],
    },
  };

  it('rejects sandbox import in production for non-administrative users with FORBIDDEN', async () => {
    process.env.NODE_ENV = 'production';

    vi.mocked(captureImport.resolveImportRows).mockResolvedValueOnce({
      ok: true,
      rows: [
        {
          rowNumber: 2,
          fields: {
            name: 'Neon Byte Arcade [Sandbox]',
            email: 'contact@neonbyte.sandbox.lavivenzia.internal',
          },
        },
      ],
      mapping: null,
    });

    vi.mocked(callerContext.resolveCaller).mockResolvedValueOnce({
      workspaceMemberId: 'member-user',
      displayName: 'Standard User',
      firstName: 'Standard',
      userId: 'user-1',
      isAdmin: false,
      permissionFlags: [],
      objectPermissions: {},
      lens: 'HUNTER',
      availableLenses: ['HUNTER'],
    });

    const result = await handler(sandboxEvent);

    expect(result.ok).toBe(false);
    expect(result.refusal).toBe('FORBIDDEN');
    expect(result.error).toContain('Sandbox fixture lead import is restricted to administrators');
  });

  it('allows sandbox import in production when caller isAdmin is true', async () => {
    process.env.NODE_ENV = 'production';

    vi.mocked(captureImport.resolveImportRows).mockResolvedValueOnce({
      ok: true,
      rows: sandboxEvent.body.rows,
      mapping: null,
    });

    vi.mocked(callerContext.resolveCaller).mockResolvedValueOnce({
      workspaceMemberId: 'member-admin',
      displayName: 'Admin User',
      firstName: 'Admin',
      userId: 'user-admin',
      isAdmin: true,
      permissionFlags: ['WORKSPACE'],
      objectPermissions: {},
      lens: 'ADMIN',
      availableLenses: ['ADMIN'],
    });

    const result = await handler(sandboxEvent);

    expect(result.refusal).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it('permits sandbox import in development / test mode for non-admin users', async () => {
    process.env.NODE_ENV = 'test';

    vi.mocked(captureImport.resolveImportRows).mockResolvedValueOnce({
      ok: true,
      rows: sandboxEvent.body.rows,
      mapping: null,
    });

    vi.mocked(callerContext.resolveCaller).mockResolvedValueOnce({
      workspaceMemberId: 'member-dev',
      displayName: 'Dev User',
      firstName: 'Dev',
      userId: 'user-dev',
      isAdmin: false,
      permissionFlags: [],
      objectPermissions: {},
      lens: 'HUNTER',
      availableLenses: ['HUNTER'],
    });

    const result = await handler(sandboxEvent);

    expect(result.refusal).toBeUndefined();
    expect(result.ok).toBe(true);
  });

  it('rejects bypass attempt with arbitrary importKey when rows contain sandbox identities in production', async () => {
    process.env.NODE_ENV = 'production';

    const bypassEvent = {
      userWorkspaceId: 'workspace-1',
      workspaceMemberId: 'member-user',
      body: {
        importKey: 'e0000000-0000-0000-0000-000000000001', // Arbitrary random UUID
        rows: [
          {
            rowNumber: 2,
            decision: 'CREATE',
            fields: {
              name: 'Disguised Venue [Sandbox]',
              email: 'stealth@venue.sandbox.lavivenzia.internal',
            },
          },
        ],
      },
    };

    vi.mocked(captureImport.resolveImportRows).mockResolvedValueOnce({
      ok: true,
      rows: [
        {
          rowNumber: 2,
          fields: {
            name: 'Disguised Venue [Sandbox]',
            email: 'stealth@venue.sandbox.lavivenzia.internal',
          },
        },
      ],
      mapping: null,
    });

    vi.mocked(callerContext.resolveCaller).mockResolvedValueOnce({
      workspaceMemberId: 'member-user',
      displayName: 'Standard User',
      firstName: 'Standard',
      userId: 'user-1',
      isAdmin: false,
      permissionFlags: [],
      objectPermissions: {},
      lens: 'HUNTER',
      availableLenses: ['HUNTER'],
    });

    const result = await handler(bypassEvent);

    expect(result.ok).toBe(false);
    expect(result.refusal).toBe('FORBIDDEN');
    expect(result.error).toContain('Sandbox fixture lead import is restricted to administrators');
  });

  it('permits ordinary legitimate production CSV imports for non-admin users', async () => {
    process.env.NODE_ENV = 'production';

    const legitimateEvent = {
      userWorkspaceId: 'workspace-1',
      workspaceMemberId: 'member-user',
      body: {
        importKey: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        rows: [],
      },
    };

    vi.mocked(captureImport.resolveImportRows).mockResolvedValueOnce({
      ok: true,
      rows: [
        {
          rowNumber: 2,
          fields: {
            name: 'The Orchid Hotel Pune',
            email: 'reservations@orchidhomes.com',
            phone: '+91 98220 54321',
          },
        },
      ],
      mapping: null,
    });

    vi.mocked(callerContext.resolveCaller).mockResolvedValueOnce({
      workspaceMemberId: 'member-user',
      displayName: 'Standard User',
      firstName: 'Standard',
      userId: 'user-1',
      isAdmin: false,
      permissionFlags: [],
      objectPermissions: {},
      lens: 'HUNTER',
      availableLenses: ['HUNTER'],
    });

    const result = await handler(legitimateEvent);

    // Should NOT be blocked with FORBIDDEN
    expect(result.refusal).not.toBe('FORBIDDEN');
  });

  it('rejects unauthenticated requests before checking sandbox or reading data', async () => {
    const unauthenticatedEvent = {
      userWorkspaceId: 'workspace-1',
      // workspaceMemberId missing/null
      body: {
        importKey: '7f9c2d18-3a81-4b72-9b04-8e1c64df3310',
      },
    };

    const result = await handler(unauthenticatedEvent);

    expect(result.ok).toBe(false);
    expect(result.refusal).toBe('NOT_AUTHENTICATED');
    expect(captureService.createCapturedLead).not.toHaveBeenCalled();
  });

  it('rejects forged client-supplied admin role in body when server session is non-admin', async () => {
    process.env.NODE_ENV = 'production';

    // Attacker sends forged role claims in the request body
    const forgedEvent = {
      userWorkspaceId: 'workspace-1',
      workspaceMemberId: 'member-user',
      body: {
        mode: 'SANDBOX',
        importKey: '7f9c2d18-3a81-4b72-9b04-8e1c64df3310',
        role: 'ADMIN',
        isAdmin: true,
        permissionFlags: ['WORKSPACE'],
        rows: [
          {
            rowNumber: 2,
            decision: 'CREATE',
            fields: {
              name: 'Attack Venue [Sandbox]',
              email: 'test@sandbox.lavivenzia.internal',
            },
          },
        ],
      },
    };

    vi.mocked(captureImport.resolveImportRows).mockResolvedValueOnce({
      ok: true,
      rows: [
        {
          rowNumber: 2,
          fields: {
            name: 'Attack Venue [Sandbox]',
            email: 'test@sandbox.lavivenzia.internal',
          },
        },
      ],
      mapping: null,
    });

    // Server-side session verification returns non-admin
    vi.mocked(callerContext.resolveCaller).mockResolvedValueOnce({
      workspaceMemberId: 'member-user',
      displayName: 'Standard User',
      firstName: 'Standard',
      userId: 'user-1',
      isAdmin: false,
      permissionFlags: [],
      objectPermissions: {},
      lens: 'HUNTER',
      availableLenses: ['HUNTER'],
    });

    const result = await handler(forgedEvent);

    expect(result.ok).toBe(false);
    expect(result.refusal).toBe('FORBIDDEN');
    expect(captureService.createCapturedLead).not.toHaveBeenCalled();
  });

  it('rejects sandbox import when STAGE=prod is configured in environment', async () => {
    delete process.env.NODE_ENV;
    process.env.STAGE = 'prod';

    vi.mocked(captureImport.resolveImportRows).mockResolvedValueOnce({
      ok: true,
      rows: [
        {
          rowNumber: 2,
          fields: {
            name: 'Neon Byte Arcade [Sandbox]',
            email: 'contact@neonbyte.sandbox.lavivenzia.internal',
          },
        },
      ],
      mapping: null,
    });

    vi.mocked(callerContext.resolveCaller).mockResolvedValueOnce({
      workspaceMemberId: 'member-user',
      displayName: 'Standard User',
      firstName: 'Standard',
      userId: 'user-1',
      isAdmin: false,
      permissionFlags: [],
      objectPermissions: {},
      lens: 'HUNTER',
      availableLenses: ['HUNTER'],
    });

    const result = await handler(sandboxEvent);

    expect(result.ok).toBe(false);
    expect(result.refusal).toBe('FORBIDDEN');
    expect(captureService.createCapturedLead).not.toHaveBeenCalled();
  });

  it('rejects stealth sandbox payload where name has no tag but websiteUrl is sandbox domain', async () => {
    process.env.NODE_ENV = 'production';

    const stealthEvent = {
      userWorkspaceId: 'workspace-1',
      workspaceMemberId: 'member-user',
      body: {
        importKey: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
        rows: [
          {
            rowNumber: 2,
            decision: 'CREATE',
            fields: {
              name: 'Normal Venue Name',
              websiteUrl: 'https://venue.sandbox.lavivenzia.internal/test',
              email: 'contact@normalvenue.com',
            },
          },
        ],
      },
    };

    vi.mocked(captureImport.resolveImportRows).mockResolvedValueOnce({
      ok: true,
      rows: [
        {
          rowNumber: 2,
          fields: {
            name: 'Normal Venue Name',
            websiteUrl: 'https://venue.sandbox.lavivenzia.internal/test',
            email: 'contact@normalvenue.com',
          },
        },
      ],
      mapping: null,
    });

    vi.mocked(callerContext.resolveCaller).mockResolvedValueOnce({
      workspaceMemberId: 'member-user',
      displayName: 'Standard User',
      firstName: 'Standard',
      userId: 'user-1',
      isAdmin: false,
      permissionFlags: [],
      objectPermissions: {},
      lens: 'HUNTER',
      availableLenses: ['HUNTER'],
    });

    const result = await handler(stealthEvent);

    expect(result.ok).toBe(false);
    expect(result.refusal).toBe('FORBIDDEN');
    expect(captureService.createCapturedLead).not.toHaveBeenCalled();
  });

  it('rejects standard import using the reserved sandbox UUID with INVALID_INPUT before reading or writing data', async () => {
    // Normal CSV import attempting to reuse the reserved sandbox key without explicit sandbox mode
    const standardImportUsingReservedKey = {
      userWorkspaceId: 'workspace-1',
      workspaceMemberId: 'member-user',
      body: {
        importKey: '7f9c2d18-3a81-4b72-9b04-8e1c64df3310',
        rows: [
          {
            rowNumber: 2,
            decision: 'CREATE',
            fields: {
              name: 'Legitimate Pune Customer',
              email: 'customer@legitimatebusiness.com',
            },
          },
        ],
      },
    };

    const result = await handler(standardImportUsingReservedKey);

    expect(result.ok).toBe(false);
    expect(result.refusal).toBe('INVALID_INPUT');
    expect(result.error).toContain('The reserved sandbox import key cannot be used for standard imports');
    expect(captureService.createCapturedLead).not.toHaveBeenCalled();
  });

  it('rejects sandbox mode import with file mapping with INVALID_INPUT', async () => {
    const fileMappedSandboxAttempt = {
      userWorkspaceId: 'workspace-1',
      workspaceMemberId: 'member-admin',
      body: {
        mode: 'SANDBOX',
        importKey: '7f9c2d18-3a81-4b72-9b04-8e1c64df3310',
        mapping: { 0: 'name', 1: 'email' },
      },
    };

    vi.mocked(captureImport.resolveImportRows).mockResolvedValueOnce({
      ok: true,
      rows: [
        {
          rowNumber: 2,
          fields: {
            name: 'Neon Byte Arcade [Sandbox]',
            email: 'contact@neonbyte.sandbox.lavivenzia.internal',
          },
        },
      ],
      mapping: { 0: 'name', 1: 'email' },
    });

    const result = await handler(fileMappedSandboxAttempt);

    expect(result.ok).toBe(false);
    expect(result.refusal).toBe('INVALID_INPUT');
    expect(result.error).toContain('Sandbox import mode cannot be used with uploaded CSV file mapping');
    expect(captureService.createCapturedLead).not.toHaveBeenCalled();
  });

  it('rejects sandbox mode import when importKey is not the designated Pune sandbox key', async () => {
    const invalidKeySandboxAttempt = {
      userWorkspaceId: 'workspace-1',
      workspaceMemberId: 'member-admin',
      body: {
        mode: 'SANDBOX',
        importKey: 'c8d9e0f1-2a3b-4c5d-6e7f-8a9b0c1d2e3f',
        rows: [
          {
            rowNumber: 2,
            decision: 'CREATE',
            fields: {
              name: 'Neon Byte Arcade [Sandbox]',
              email: 'contact@neonbyte.sandbox.lavivenzia.internal',
            },
          },
        ],
      },
    };

    vi.mocked(captureImport.resolveImportRows).mockResolvedValueOnce({
      ok: true,
      rows: [
        {
          rowNumber: 2,
          fields: {
            name: 'Neon Byte Arcade [Sandbox]',
            email: 'contact@neonbyte.sandbox.lavivenzia.internal',
          },
        },
      ],
      mapping: null,
    });

    const result = await handler(invalidKeySandboxAttempt);

    expect(result.ok).toBe(false);
    expect(result.refusal).toBe('INVALID_INPUT');
    expect(result.error).toContain('Sandbox import mode requires the designated Pune pilot sandbox import key');
    expect(captureService.createCapturedLead).not.toHaveBeenCalled();
  });

  it('rejects sandbox mode import when payload contains ordinary customer records instead of verified fixtures', async () => {
    const realCustomerInSandboxMode = {
      userWorkspaceId: 'workspace-1',
      workspaceMemberId: 'member-admin',
      body: {
        mode: 'SANDBOX',
        importKey: '7f9c2d18-3a81-4b72-9b04-8e1c64df3310',
        rows: [
          {
            rowNumber: 2,
            decision: 'CREATE',
            fields: {
              name: 'Grand Hyatt Pune',
              email: 'concierge@hyatt.com',
            },
          },
        ],
      },
    };

    vi.mocked(captureImport.resolveImportRows).mockResolvedValueOnce({
      ok: true,
      rows: [
        {
          rowNumber: 2,
          fields: {
            name: 'Grand Hyatt Pune',
            email: 'concierge@hyatt.com',
          },
        },
      ],
      mapping: null,
    });

    const result = await handler(realCustomerInSandboxMode);

    expect(result.ok).toBe(false);
    expect(result.refusal).toBe('INVALID_INPUT');
    expect(result.error).toContain('Sandbox import mode requires verified sandbox fixture records');
    expect(captureService.createCapturedLead).not.toHaveBeenCalled();
  });

  it('preserves sandbox isolation even after user edits name and email via durable captureKey', () => {
    // Record originally imported with colon-delimited captureKey
    const editedLead = {
      name: 'The Grand Palace Resort', // [Sandbox] tag stripped by user
      organisationName: 'Palace Hospitality Group',
      emails: { primaryEmail: 'info@grandpalacepune.com' }, // non-sandbox email
      phones: { primaryPhoneNumber: '+91 98220 54321' },
      website: { primaryLinkUrl: 'https://grandpalacepune.com' },
      captureKey: '7f9c2d18-3a81-4b72-9b04-8e1c64df3310:4',
    };

    expect(isSandboxLead(editedLead)).toBe(true);
    const guardOutcome = assertOutboundTelephonyAllowed(editedLead, 'PHONE');
    expect(guardOutcome.allowed).toBe(false);
    expect(guardOutcome.reason).toContain('Outbound PHONE is quarantined for sandbox lead');
  });

  it('does not misclassify legitimate Maharashtra Indian phone numbers as sandbox', () => {
    const realCustomer = {
      name: 'Patil Logistics Pune',
      organisationName: 'Patil Enterprises',
      emails: { primaryEmail: 'dispatch@patillogistics.com' },
      phones: { primaryPhoneNumber: '+91 98220 12345' }, // active Pune 9822 mobile
      website: { primaryLinkUrl: 'https://patillogistics.com' },
      captureKey: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d:1',
    };

    expect(isSandboxLead(realCustomer)).toBe(false);
    const guardOutcome = assertOutboundTelephonyAllowed(realCustomer, 'PHONE');
    expect(guardOutcome.allowed).toBe(true);
  });
});
