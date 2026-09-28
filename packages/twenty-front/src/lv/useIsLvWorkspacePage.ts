import { navigationMenuItemsSelector } from '@/navigation-menu-item/common/states/navigationMenuItemsSelector';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useMatch } from 'react-router-dom';

// True when the La Vivenzia workspace is the page being shown.
//
// That page is a single front component that draws its own sidebar, top bar
// and content (the approved reference design — docs/UI-EXACT-MATCH-PLAN.md).
// Twenty's own navigation drawer and page header are therefore suppressed for
// it, or the product would carry two navigations stacked on each other.
//
// The match is by the navigation item's name rather than an id, because the
// page layout's id is assigned per workspace while the name comes from the
// application manifest and is the same everywhere it is installed.
export const LV_WORKSPACE_NAVIGATION_ITEM_NAME = 'La Vivenzia';

export const useIsLvWorkspacePage = (): boolean => {
  const match = useMatch('/page/:pageLayoutId');
  const navigationMenuItems = useAtomStateValue(navigationMenuItemsSelector);
  const pageLayoutId = match?.params.pageLayoutId;

  if (pageLayoutId === undefined) {
    return false;
  }

  return navigationMenuItems.some(
    (item) =>
      item.name === LV_WORKSPACE_NAVIGATION_ITEM_NAME &&
      item.pageLayoutId === pageLayoutId,
  );
};
