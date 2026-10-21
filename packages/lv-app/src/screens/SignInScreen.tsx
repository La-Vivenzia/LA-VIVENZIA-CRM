import { useId, useState, type FormEvent } from 'react';

import { signIn } from 'src/api/client';
import { Field, InlineNotice, LvButton, LvCard, LvInput } from 'src/design/kit';
import { LV_ASSETS } from 'src/design/shell';
import { type LvTheme } from 'src/design/theme';

// Sign in. Credentials go straight to Twenty's own mutation — this screen
// never sees a password policy, a session rule or a token refresh; it only
// asks, and shows what the server said.
export const SignInScreen = ({ theme, onSignedIn, notice }: { theme: LvTheme; onSignedIn: () => void; /** Why they are here, when they did not choose to be. */ notice?: string }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      await signIn(email.trim(), password);
      onSignedIn();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign-in failed.');
      setBusy(false);
    }
  };

  return (
    <div className="lv-root" style={{ minHeight: '100vh', display: 'flex', background: theme.color.page }}>
      <div style={{ flex: '1 1 0', display: 'grid', placeItems: 'center', padding: theme.space(6) }}>
        <LvCard theme={theme} style={{ width: '100%', maxWidth: 420, padding: theme.space(8) }}>
          <img src={LV_ASSETS.logo} alt="La Vivenzia" height={34} style={{ height: 34, width: 'auto', marginBottom: theme.space(6) }} />
          <h1 style={{ fontFamily: theme.font.body, fontSize: 24, fontWeight: 600, color: theme.color.heading, margin: 0 }}>Welcome back</h1>
          <p style={{ ...theme.type.body, color: theme.color.textMuted, margin: `${theme.space(1)}px 0 ${theme.space(6)}px` }}>
            Sign in to your workspace.
          </p>

          {/* A session that ran out is not a failed sign-in: it is said in
              its own words, above the form, so nobody thinks they typed
              something wrong. */}
          {notice && (
            <div style={{ marginBottom: theme.space(5) }}>
              <InlineNotice theme={theme} tone="warning">
                {notice}
              </InlineNotice>
            </div>
          )}

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: theme.space(4) }}>
            <Field theme={theme} label="Email" htmlFor={emailId} required>
              <LvInput theme={theme} id={emailId} value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="username" required />
            </Field>
            <Field theme={theme} label="Password" htmlFor={passwordId} required>
              <LvInput theme={theme} id={passwordId} value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
            </Field>
            {error && <InlineNotice theme={theme} tone="danger">{error}</InlineNotice>}
            <LvButton theme={theme} variant="primary" type="submit" busy={busy}>
              Sign in
            </LvButton>
          </form>
        </LvCard>
      </div>
      <div
        className="lv-hide-mobile"
        style={{
          flex: '1 1 0',
          backgroundImage: `url(${LV_ASSETS.hero})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
    </div>
  );
};
