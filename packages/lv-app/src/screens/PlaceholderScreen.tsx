import { EmptyState, LvCard } from 'src/design/kit';
import { type LvDoorDefinition } from 'src/design/shell';
import { type LvTheme } from 'src/design/theme';

// A door whose screen has not been built yet says so plainly rather than
// pretending to be empty.
export const PlaceholderScreen = ({ theme, door }: { theme: LvTheme; door: LvDoorDefinition }) => (
  <LvCard theme={theme}>
    <EmptyState theme={theme} title={door.label} text={`${door.description} — this screen is being built.`} />
  </LvCard>
);
