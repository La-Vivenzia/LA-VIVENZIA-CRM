import { styled } from '@linaria/react';
import { useParams } from 'react-router-dom';

import { CommandMenuComponentInstanceContext } from '@/command-menu/states/contexts/CommandMenuComponentInstanceContext';
import { PageLayoutRenderer } from '@/page-layout/components/PageLayoutRenderer';
import { LayoutRenderingProvider } from '@/ui/layout/contexts/LayoutRenderingContext';
import { PageCardLayout } from '@/ui/layout/page/components/PageCardLayout';
import { isDefined } from 'twenty-shared/utils';
import { PageLayoutType } from '~/generated-metadata/graphql';
import { useIsLvWorkspacePage } from '~/lv/useIsLvWorkspacePage';
import { StandalonePageHeader } from '~/pages/page-layout/StandalonePageHeader';

const StyledPageLayoutContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;

  @media print {
    display: block;
    min-height: auto;
    overflow: visible;
  }
`;

export const StandalonePageLayoutPage = () => {
  const { pageLayoutId } = useParams<{ pageLayoutId: string }>();
  // The La Vivenzia workspace owns the whole viewport: no card, no header.
  const isLvWorkspacePage = useIsLvWorkspacePage();

  if (!isDefined(pageLayoutId)) {
    return null;
  }

  if (isLvWorkspacePage) {
    return (
      <CommandMenuComponentInstanceContext.Provider
        value={{ instanceId: pageLayoutId }}
      >
        <LayoutRenderingProvider
          value={{
            targetRecordIdentifier: undefined,
            layoutType: PageLayoutType.STANDALONE_PAGE,
          }}
        >
          <StyledPageLayoutContainer>
            <PageLayoutRenderer pageLayoutId={pageLayoutId} />
          </StyledPageLayoutContainer>
        </LayoutRenderingProvider>
      </CommandMenuComponentInstanceContext.Provider>
    );
  }

  return (
    <CommandMenuComponentInstanceContext.Provider
      value={{ instanceId: pageLayoutId }}
    >
      <PageCardLayout
        header={<StandalonePageHeader pageLayoutId={pageLayoutId} />}
      >
        <LayoutRenderingProvider
          value={{
            targetRecordIdentifier: undefined,
            layoutType: PageLayoutType.STANDALONE_PAGE,
          }}
        >
          <StyledPageLayoutContainer>
            <PageLayoutRenderer pageLayoutId={pageLayoutId} />
          </StyledPageLayoutContainer>
        </LayoutRenderingProvider>
      </PageCardLayout>
    </CommandMenuComponentInstanceContext.Provider>
  );
};
