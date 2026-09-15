import { styled } from '@linaria/react';
import { Trans } from '@lingui/react/macro';

import { useWorkspaceBypass } from '@/auth/sign-in-up/hooks/useWorkspaceBypass';
import { useIsCurrentLocationOnAWorkspace } from '@/domain-manager/hooks/useIsCurrentLocationOnAWorkspace';
import { ONBOARDING_CONTENT_BLOCK_WIDTH } from '@/onboarding/constants/OnboardingContentBlockWidth';
import { themeCssVariables } from 'twenty-ui/theme-constants';

const StyledCopyContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.sm};
  line-height: 1.4;
  max-width: ${ONBOARDING_CONTENT_BLOCK_WIDTH}px;
  text-align: center;

  & > a {
    color: ${themeCssVariables.font.color.tertiary};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const StyledLinksContainer = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
  flex-wrap: nowrap;
  font-size: ${themeCssVariables.font.size.sm};
  gap: ${themeCssVariables.spacing[2]};
  justify-content: center;
  max-width: 100%;
  text-align: center;
  white-space: nowrap;

  & > a,
  & > button {
    background: none;
    border: none;
    color: ${themeCssVariables.font.color.tertiary};
    cursor: pointer;
    font: inherit;
    padding: 0;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
`;

const StyledSeparator = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
`;

type FooterNoteProps = {
  // Kept for call-site compatibility; the agreement links were removed (CM-005).
  secondaryAgreement?: 'privacyPolicy' | 'dataProcessingAgreement';
};

export const FooterNote = (_props: FooterNoteProps) => {
  const { isOnAWorkspace } = useIsCurrentLocationOnAWorkspace();

  const { shouldOfferBypass, shouldUseBypass, enableBypass } =
    useWorkspaceBypass();

  // The upstream note bound the user to Twenty's own terms, DPA and privacy
  // policy at twenty.com. This is a self-hosted, internal La Vivenzia system,
  // so those agreements do not apply; an internal-use notice replaces them
  // (CM-005). Employee legal pages, if the founders want them, can be linked
  // here later.
  if (!isOnAWorkspace) {
    return (
      <StyledCopyContainer>
        <Trans>
          Internal system for authorised La Vivenzia team members only.
        </Trans>
      </StyledCopyContainer>
    );
  }

  return (
    <StyledLinksContainer>
      {shouldOfferBypass && !shouldUseBypass && (
        <>
          <button type="button" onClick={enableBypass}>
            <Trans>Bypass SSO</Trans>
          </button>
          <StyledSeparator>•</StyledSeparator>
        </>
      )}
      <span>
        <Trans>Authorised La Vivenzia team members only</Trans>
      </span>
    </StyledLinksContainer>
  );
};
