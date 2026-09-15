import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoreApiClient } from 'twenty-client-sdk/core';
import { defineFrontComponent } from 'twenty-sdk/define';
import { AppPath, navigate, useColorScheme, useRecordId } from 'twenty-sdk/front-component';

import { FC_LEAD_360_ID } from 'src/constants/universal-identifiers';
import {
  EditLeadForm,
  InteractionForm,
  NoteForm,
  OwnerForm,
  RescheduleForm,
  StatusForm,
  TaskForm,
} from 'src/modules/lv-core/front-components/lead-360/forms';
import { type Lead360Section, sectionOrderFor } from 'src/modules/lv-core/front-components/lead-360/lead-360-view';
import {
  type ActionKey,
  ActionBar,
  AssignmentSection,
  DocumentsSection,
  Header,
  IntelligenceSummary,
  LifecycleSection,
  NextActionPanel,
  NotesSection,
  OnboardingSection,
  OverviewSection,
  SlaSection,
  TasksSection,
  TimelineSection,
} from 'src/modules/lv-core/front-components/lead-360/sections';
import { type Lead360Model, type TaskSummary } from 'src/modules/lv-core/services/lead-360';
import { ErrorState, ForbiddenState, InlineNotice, LoadingState, LvPage } from 'src/modules/lv-core/ui/kit';
import { themeFor } from 'src/modules/lv-core/ui/theme';
import { callRoute } from 'src/modules/lv-core/utils/call-route';

// Lead 360 — the employee's workspace for one relationship.
//
// One request (/leads/360) returns the whole page under the caller's
// permissions; every button here maps to a governed route that derives the
// actor from the session and audits the action. The page never writes
// status or owner directly and never decides on its own what a role may
// do: it renders `capabilities` and reloads after each action.

type Refusal = { ok: false; refusal?: string; error?: string };

type LoadState =
  | { phase: 'LOADING' }
  | { phase: 'READY'; model: Lead360Model }
  | { phase: 'FORBIDDEN'; text: string }
  | { phase: 'ERROR'; text: string };

type OpenForm = { kind: ActionKey } | { kind: 'RESCHEDULE'; task: TaskSummary } | null;

export const Lead360 = () => {
  const recordId = useRecordId();
  const scheme = useColorScheme();
  const theme = useMemo(() => themeFor(scheme), [scheme]);
  const client = useMemo(() => new CoreApiClient(), []);
  const [state, setState] = useState<LoadState>({ phase: 'LOADING' });
  const [open, setOpen] = useState<OpenForm>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [viewing, setViewing] = useState<{ id: string; url: string | null; error: string | null } | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!recordId) {
      return;
    }

    if (!quiet) {
      setState({ phase: 'LOADING' });
    }

    try {
      const response = (await callRoute('/leads/360', { leadId: recordId })) as Lead360Model | Refusal;

      if (response.ok === false) {
        const refusal = (response as Refusal).refusal;

        setState(
          refusal === 'NOT_FOUND' || refusal === 'NOT_AUTHORIZED' || refusal === 'NOT_AUTHENTICATED'
            ? { phase: 'FORBIDDEN', text: "You don't have permission to view this information." }
            : { phase: 'ERROR', text: (response as Refusal).error ?? 'Unable to load this lead.' },
        );

        return;
      }

      setState({ phase: 'READY', model: response as Lead360Model });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Unable to load this lead.';

      setState(/not found|not yours|permission|not accessible/i.test(message) ? { phase: 'FORBIDDEN', text: "You don't have permission to view this information." } : { phase: 'ERROR', text: message });
    }
  }, [recordId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (path: string, body: Record<string, unknown>, successText: string) => {
    setBusy(true);
    setNotice(null);

    try {
      await callRoute(path, body);
      setNotice(successText);
      setOpen(null);
      // The lvInteraction.created / lvLead.updated hooks finish a moment
      // after the route returns; a short delay lets the follow-up task,
      // notifications and SLA changes appear on the first reload.
      await new Promise((resolve) => setTimeout(resolve, 900));
      await load(true);
    } finally {
      setBusy(false);
    }
  };

  const openRecord = (target: { object: string; recordId: string }) => {
    void navigate(AppPath.RecordShowPage, { objectNameSingular: target.object, objectRecordId: target.recordId });
  };

  const onAction = (action: ActionKey) => {
    setNotice(null);

    if (state.phase !== 'READY') {
      return;
    }

    const { model } = state;

    if (action === 'ONBOARDING') {
      if (model.onboarding) {
        openRecord({ object: 'lvOnboarding', recordId: model.onboarding.id });
      } else {
        void startOnboarding(model);
      }

      return;
    }

    if (action === 'DOCUMENTS') {
      if (model.onboarding) {
        openRecord({ object: 'lvOnboarding', recordId: model.onboarding.id });
      }

      return;
    }

    if (action === 'MORE') {
      setNotice('Archive, close, mark duplicate, reopen and deletion impact live on the Actions tab; the Intelligence tab holds AI drafts, summaries and duplicate decisions.');

      return;
    }

    setOpen((current) => (current && current.kind === action ? null : { kind: action }));
  };

  // Starting onboarding creates the lvOnboarding record as the caller (the
  // onboarding permission binds), then opens it; lv-on-onboarding-updated
  // mirrors the status to the lead from there.
  const startOnboarding = async (model: Lead360Model) => {
    setBusy(true);
    setNotice(null);

    try {
      const created = await client.mutation({
        createLvOnboarding: {
          __args: { data: { name: `${model.lead.lvLeadId ?? ''} ${model.lead.name ?? ''} onboarding`.trim(), leadId: model.lead.id, status: 'INITIATED', currentStep: 'BASIC_INFORMATION' } },
          id: true,
        },
      });
      const id = (created as { createLvOnboarding?: { id?: string } }).createLvOnboarding?.id;

      if (id) {
        setNotice('Onboarding started.');
        openRecord({ object: 'lvOnboarding', recordId: id });
      } else {
        setNotice('Onboarding was not started.');
      }
    } catch (caught) {
      setNotice(caught instanceof Error ? `Onboarding was not started: ${caught.message}` : 'Onboarding was not started.');
    } finally {
      setBusy(false);
    }
  };

  const viewDocument = async (documentId: string) => {
    if (viewing?.id === documentId) {
      setViewing(null);

      return;
    }

    setViewing({ id: documentId, url: null, error: null });

    try {
      const result = await client.query({ lvOnboardingDocument: { __args: { filter: { id: { eq: documentId } } }, file: true } });
      const files = (result as { lvOnboardingDocument?: { file?: unknown } }).lvOnboardingDocument?.file;
      const url = Array.isArray(files) ? ((files[0] as { url?: string } | undefined)?.url ?? null) : null;

      setViewing({ id: documentId, url, error: url ? null : 'No file is attached to this document.' });
    } catch {
      setViewing({ id: documentId, url: null, error: "You don't have permission to open this document." });
    }
  };

  const completeTask = (model: Lead360Model, task: TaskSummary) => void run('/tasks/update', { leadId: model.lead.id, taskId: task.id, action: 'COMPLETE' }, `“${task.title ?? 'Task'}” completed.`);

  const acceptSuggestion = (model: Lead360Model) => {
    const suggestion = model.nextAction.suggestion?.proposedTask;

    if (!suggestion) {
      return;
    }

    void run('/tasks/create', { leadId: model.lead.id, title: suggestion.title, dueAt: suggestion.dueAt, priority: suggestion.priority, timezoneOffsetMinutes: new Date().getTimezoneOffset() }, `Next action set: “${suggestion.title}”.`);
  };

  const editLead = async (model: Lead360Model, body: Record<string, unknown>) => {
    setBusy(true);
    setNotice(null);

    try {
      await client.mutation({ updateLvLead: { __args: { id: model.lead.id, data: body }, id: true } });
      setNotice('Lead updated.');
      setOpen(null);
      await load(true);
    } finally {
      setBusy(false);
    }
  };

  if (!recordId) {
    return null;
  }

  return (
    <LvPage theme={theme} maxWidth={1400} className="lv-360">
      <style>{`.lv-360 textarea, .lv-360 select, .lv-360 input { font: inherit; }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
        {state.phase === 'LOADING' && <LoadingState theme={theme} rows={4} label="Loading lead" />}
        {state.phase === 'ERROR' && <ErrorState theme={theme} text={`Unable to load this lead. ${state.text}`} onRetry={() => void load()} />}
        {state.phase === 'FORBIDDEN' && <ForbiddenState theme={theme} title={state.text} text="Leads are scoped to their owner. Ask an administrator to reassign it, or claim it if it is unassigned." />}
        {state.phase === 'READY' && renderReady(state.model)}
      </div>
    </LvPage>
  );

  // A render function, not a nested component: a component declared inside
  // Lead360 would be a new type on every render and remount the open form,
  // wiping what the person had typed each time `busy` flipped.
  function renderReady(model: Lead360Model) {
    const order = sectionOrderFor(model.caller.lens);
    const form = (() => {
      if (!open) {
        return null;
      }

      switch (open.kind) {
        case 'INTERACTION':
          return <InteractionForm theme={theme} leadId={model.lead.id} onSubmit={(body) => run('/interactions/log', body, 'Interaction logged. The follow-up and lead summary update in a moment.')} onCancel={() => setOpen(null)} />;
        case 'TASK':
          return <TaskForm theme={theme} leadId={model.lead.id} members={model.members} defaultAssigneeId={model.caller.workspaceMemberId} onSubmit={(body) => run('/tasks/create', body, 'Task created.')} onCancel={() => setOpen(null)} />;
        case 'NOTE':
          return <NoteForm theme={theme} leadId={model.lead.id} onSubmit={(body) => run('/notes/create', body, 'Note added.')} onCancel={() => setOpen(null)} />;
        case 'STATUS':
          return <StatusForm theme={theme} leadId={model.lead.id} currentStatus={model.lead.status} settableStatuses={model.settableStatuses} onSubmit={(body) => run('/leads/lifecycle', body, 'Status changed and audited.')} onCancel={() => setOpen(null)} />;
        case 'OWNER':
          return <OwnerForm theme={theme} model={model} onSubmit={(body) => run('/leads/assign', body, 'Owner changed. The new owner has been notified.')} onCancel={() => setOpen(null)} />;
        case 'EDIT':
        case 'PRIORITY':
          return <EditLeadForm theme={theme} model={model} onSubmit={(body) => editLead(model, body)} onCancel={() => setOpen(null)} />;
        case 'RESCHEDULE':
          return <RescheduleForm theme={theme} leadId={model.lead.id} task={open.task} onSubmit={(body) => run('/tasks/update', body, 'Task rescheduled.')} onCancel={() => setOpen(null)} />;
        default:
          return null;
      }
    })();

    const section = (key: Lead360Section) => {
      switch (key) {
        case 'NEXT_ACTION':
          return (
            <NextActionPanel
              key={key}
              theme={theme}
              model={model}
              busy={busy}
              onComplete={(task) => completeTask(model, task)}
              onReschedule={(task) => setOpen({ kind: 'RESCHEDULE', task })}
              onAddAction={() => setOpen({ kind: 'TASK' })}
              onLogInteraction={() => setOpen({ kind: 'INTERACTION' })}
              onAcceptSuggestion={() => acceptSuggestion(model)}
            />
          );
        case 'OVERVIEW':
          return <OverviewSection key={key} theme={theme} model={model} />;
        case 'INTELLIGENCE':
          return <IntelligenceSummary key={key} theme={theme} model={model} onOpenIntelligence={() => setNotice('Open the Intelligence tab above for AI drafts, summaries, classification and duplicate decisions.')} />;
        case 'TIMELINE':
          return <TimelineSection key={key} theme={theme} model={model} onOpen={openRecord} onLogInteraction={model.capabilities.canLogInteraction ? () => setOpen({ kind: 'INTERACTION' }) : undefined} />;
        case 'TASKS':
          return <TasksSection key={key} theme={theme} model={model} busy={busy} onComplete={(task) => completeTask(model, task)} onReschedule={(task) => setOpen({ kind: 'RESCHEDULE', task })} onCreate={() => setOpen({ kind: 'TASK' })} />;
        case 'SLA':
          return <SlaSection key={key} theme={theme} model={model} onOpen={openRecord} />;
        case 'ONBOARDING':
          return <OnboardingSection key={key} theme={theme} model={model} busy={busy} onOpenOnboarding={() => model.onboarding && openRecord({ object: 'lvOnboarding', recordId: model.onboarding.id })} onStart={() => void startOnboarding(model)} />;
        case 'DOCUMENTS':
          return <DocumentsSection key={key} theme={theme} model={model} viewing={viewing} onView={(id) => void viewDocument(id)} onReview={() => model.onboarding && openRecord({ object: 'lvOnboarding', recordId: model.onboarding.id })} />;
        case 'NOTES':
          return <NotesSection key={key} theme={theme} model={model} onAdd={() => setOpen({ kind: 'NOTE' })} onOpen={openRecord} />;
        case 'ASSIGNMENT':
          return <AssignmentSection key={key} theme={theme} model={model} onChange={() => setOpen({ kind: 'OWNER' })} />;
        case 'LIFECYCLE':
          return <LifecycleSection key={key} theme={theme} model={model} onChangeStatus={() => setOpen({ kind: 'STATUS' })} onOpenGovernance={() => setNotice('Archive, close, mark duplicate and reopen are on the Actions tab above.')} />;
        default:
          return null;
      }
    };

    return (
      <>
        <Header theme={theme} model={model} />
        <ActionBar theme={theme} model={model} onAction={onAction} open={open && open.kind !== 'RESCHEDULE' ? open.kind : null} />
        {notice && (
          <InlineNotice theme={theme} tone="info">
            {notice}
          </InlineNotice>
        )}
        {form}
        <div className="lv-fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: theme.space(3), alignItems: 'start' }}>
          {order.map((key) => section(key))}
        </div>
        <p style={{ ...theme.type.caption, margin: 0, color: theme.color.textSubtle }}>
          Viewing as {model.caller.lens.toLowerCase()} · sections are ordered for your role · every action is decided again on the server and audited with your name.
        </p>
      </>
    );
  }
};

export default defineFrontComponent({
  universalIdentifier: FC_LEAD_360_ID,
  name: 'lv-lead-360',
  description: 'Lead 360 — header, actions, next action, overview, intelligence, timeline, tasks, SLAs, onboarding, documents, notes, ownership and lifecycle for one lead',
  component: Lead360,
});
