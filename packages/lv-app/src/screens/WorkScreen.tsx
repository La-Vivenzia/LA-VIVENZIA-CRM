import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  completeTask,
  isWorkLens,
  LENS_COPY,
  reopenTask,
  rescheduleTask,
  tasksForLens,
  useWork,
  WORK_LENSES,
  type WorkLens,
  type WorkTask,
} from 'src/api/work';
import { LvIcon } from 'src/design/icons';
import { EmptyState, ErrorState, ForbiddenState, InlineNotice, isForbiddenMessage, LoadingState, LvButton, LvCard } from 'src/design/kit';
import { LvPageHeader, LvSectionNav } from 'src/design/page';
import { type LvTheme } from 'src/design/theme';
import { NewTaskSheet, TaskQueue, TaskSheet } from 'src/screens/work/parts';

// 11.1 Tasks — today, 11.2 overdue, 11.3 upcoming, 11.4 completed.
//
// Four screens in the inventory, four routes, one surface — because they are
// four buckets of the same `task` rows and a person moves between them
// constantly. The bucketing is `bucketFor` in `api/work.ts`, which is the port
// of the server's own `lv-followups/utils/follow-up-views.ts`, so this screen
// and the saved views in Twenty cannot disagree about what "today" means.
//
// Every row carries the relationship it belongs to, because `/tasks/update`
// will not act on a task without one.

export const WorkScreen = ({ theme }: { theme: LvTheme }) => {
  const navigate = useNavigate();
  const { lens: lensParam } = useParams();
  const lens: WorkLens = isWorkLens(lensParam) ? lensParam : 'today';
  const { buckets, counts, loading, error, reload } = useWork();

  const [open, setOpen] = useState<WorkTask | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // One clock for the whole render, so two rows never disagree about "now".
  const now = new Date().toISOString();
  const tasks = tasksForLens(buckets, lens);
  const copy = LENS_COPY[lens];

  const act = async (task: WorkTask, run: (taskId: string, leadId: string) => Promise<unknown>) => {
    if (task.leadId === null) {
      setActionError('That follow-up is not attached to a relationship, so it cannot be changed from here.');

      return;
    }

    setBusyId(task.id);
    setActionError(null);

    try {
      await run(task.id, task.leadId);
      setOpen(null);
      reload();
    } catch (cause) {
      // The server's own words. A refusal without its reason is a dead end.
      setActionError(cause instanceof Error ? cause.message : 'That follow-up could not be updated.');
    } finally {
      setBusyId(null);
    }
  };

  const header = (
    <LvPageHeader
      theme={theme}
      variant="panel"
      title="Your work"
      subtitle={copy.subtitle}
      onBack={() => navigate('/today')}
      backLabel="Back to Today"
      actions={
        <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setCreating(true)} icon={<LvIcon name="capture" size={16} />}>
          New follow-up
        </LvButton>
      }
    />
  );

  // A role without task permission gets Twenty's refusal, not an empty list
  // that would read as "you have no work".
  if (error !== null && isForbiddenMessage(error)) {
    return (
      <>
        {header}
        <ForbiddenState theme={theme} text="Your role cannot see follow-ups. Ask an administrator if you need them." />
      </>
    );
  }

  return (
    <>
      {header}

      <LvSectionNav
        theme={theme}
        label="Follow-up views"
        value={lens}
        sections={WORK_LENSES.map((key) => ({ key, label: LENS_COPY[key].title, count: counts[key] }))}
        onChange={(key) => navigate(`/work/${key}`)}
      />

      <LvCard theme={theme}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.space(3) }}>
          {actionError && <InlineNotice theme={theme} tone="danger">{actionError}</InlineNotice>}

          {loading ? (
            <LoadingState theme={theme} rows={4} label="Loading your work" />
          ) : error !== null ? (
            <ErrorState theme={theme} title="Your work could not be loaded" text={error} onRetry={reload} />
          ) : tasks.length === 0 ? (
            <EmptyState
              theme={theme}
              icon={lens === 'completed' ? 'check' : 'task'}
              tint={lens === 'overdue' ? 'peach' : 'mint'}
              title={copy.empty}
              text={
                lens === 'overdue'
                  ? 'Nothing has slipped past its due date.'
                  : lens === 'completed'
                    ? 'Follow-ups you finish will be listed here.'
                    : 'Follow-ups are created on a relationship — from a lead, or with the button above.'
              }
              action={
                lens === 'completed' ? undefined : (
                  <LvButton theme={theme} variant="secondary" size="sm" onClick={() => setCreating(true)}>
                    New follow-up
                  </LvButton>
                )
              }
            />
          ) : (
            <TaskQueue
              theme={theme}
              tasks={tasks}
              now={now}
              lens={lens}
              busyId={busyId}
              onOpen={setOpen}
              onOpenLead={(leadId) => navigate(`/leads/${leadId}`)}
              onPrimary={(task) => void act(task, lens === 'completed' ? reopenTask : completeTask)}
            />
          )}

          {lens === 'upcoming' && buckets.UNSCHEDULED.length > 0 && (
            <InlineNotice theme={theme}>
              {buckets.UNSCHEDULED.length} of these have no due date yet. They are listed last.
            </InlineNotice>
          )}
        </div>
      </LvCard>

      {open !== null && (
        <TaskSheet
          theme={theme}
          task={open}
          now={now}
          busy={busyId === open.id}
          error={actionError}
          onClose={() => {
            setOpen(null);
            setActionError(null);
          }}
          onComplete={() => void act(open, completeTask)}
          onReopen={() => void act(open, reopenTask)}
          onReschedule={(dueAt) => void act(open, (taskId, leadId) => rescheduleTask(taskId, leadId, dueAt))}
          onOpenLead={(leadId) => navigate(`/leads/${leadId}`)}
        />
      )}

      {creating && (
        <NewTaskSheet
          theme={theme}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            reload();
          }}
        />
      )}
    </>
  );
};
