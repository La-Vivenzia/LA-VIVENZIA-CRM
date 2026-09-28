import { LvEntryGrid, LvHero, type LvDoor } from 'src/design/shell';
import { type LvTheme } from 'src/design/theme';

// The six doors, as the reference board opens on them.
export const HomeScreen = ({ theme, firstName, onOpen }: { theme: LvTheme; firstName: string; onOpen: (door: LvDoor) => void }) => (
  <>
    <LvHero
      theme={theme}
      greeting={`Good day, ${firstName} 👋`}
      subtitle="Let's make more meaningful experiences happen today."
      aside="More experiences. A kinder world."
    />
    <LvEntryGrid theme={theme} onOpen={onOpen} />
  </>
);
