import { signOut, type Viewer } from 'src/api/client';
import { LvAvatar, LvButton, LvCard } from 'src/design/kit';
import { LvFactRow, LvSectionCard } from 'src/design/profile';
import { type LvTheme } from 'src/design/theme';

// The signed-in person's own page. Small on purpose: who you are, which
// workspace lens you see the CRM through, and the way out.
export const AccountScreen = ({ theme, viewer, onSignedOut }: { theme: LvTheme; viewer: Viewer | null; onSignedOut: () => void }) => (
  <>
    <LvCard theme={theme} style={{ padding: theme.space(5) }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.space(4) }}>
        <LvAvatar theme={theme} name={viewer?.displayName ?? 'there'} size={64} />
        <div>
          <h1 style={{ fontFamily: theme.font.body, fontSize: 22, fontWeight: 600, color: theme.color.heading, margin: 0 }}>
            {viewer?.displayName ?? 'Signed in'}
          </h1>
          <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 0` }}>{viewer?.role ?? 'Team member'}</p>
        </div>
      </div>
    </LvCard>

    <LvSectionCard theme={theme} title="Session" icon="settings">
      <LvFactRow theme={theme} label="Role">{viewer?.role ?? '—'}</LvFactRow>
      <LvFactRow theme={theme} label="Workspace member">{viewer?.workspaceMemberId ?? '—'}</LvFactRow>
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: theme.space(4) }}>
        <LvButton
          theme={theme}
          variant="secondary"
          onClick={() => {
            signOut();
            onSignedOut();
          }}
        >
          Sign out
        </LvButton>
      </div>
    </LvSectionCard>
  </>
);
