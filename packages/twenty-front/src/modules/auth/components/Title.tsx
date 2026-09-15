import { styled } from '@linaria/react';
import React from 'react';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { AnimatedEaseIn } from 'twenty-ui/layout';

type TitleProps = React.PropsWithChildren & {
  animate?: boolean;
  noMarginTop?: boolean;
};

const StyledTitle = styled.div<Pick<TitleProps, 'noMarginTop'>>`
  color: var(--lv-heading, ${themeCssVariables.font.color.primary});
  font-family: var(--lv-font-display, inherit);
  font-size: ${themeCssVariables.font.size.xl};
  font-weight: ${themeCssVariables.font.weight.semiBold};
  letter-spacing: 0.02em;
  margin-bottom: ${themeCssVariables.spacing[4]};
  margin-top: ${({ noMarginTop }) =>
    !noMarginTop ? themeCssVariables.spacing[4] : '0'};
  text-align: center;
`;

export const Title = ({
  children,
  animate = false,
  noMarginTop = false,
}: TitleProps) => {
  if (animate) {
    return (
      <StyledTitle noMarginTop={noMarginTop}>
        <AnimatedEaseIn>{children}</AnimatedEaseIn>
      </StyledTitle>
    );
  }

  return <StyledTitle noMarginTop={noMarginTop}>{children}</StyledTitle>;
};
