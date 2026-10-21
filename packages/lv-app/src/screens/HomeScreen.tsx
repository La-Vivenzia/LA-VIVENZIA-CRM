import { LvPageHeader } from 'src/design/page';
import { LvEntryGrid, type LvDoor } from 'src/design/shell';
import { type LvTheme } from 'src/design/theme';

// The six doors, as the reference board opens on them: a greeting set on the
// shell's own photograph, then one card per door. It is not a dashboard — it
// answers "where should I go", and nothing else.
export const HomeScreen = ({ theme, firstName, onOpen }: { theme: LvTheme; firstName: string; onOpen: (door: LvDoor) => void }) => (
  <>
    <LvPageHeader
      theme={theme}
      variant="hero"
      title={`Good day, ${firstName}`}
      titleIcon="sun"
      subtitle="Let's make more meaningful experiences happen today."
    />
    <LvEntryGrid theme={theme} onOpen={onOpen} />
  </>
);
