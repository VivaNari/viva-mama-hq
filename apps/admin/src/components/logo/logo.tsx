import type { LinkProps } from '@mui/material/Link';

import { mergeClasses } from 'minimal-shared/utils';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import { styled } from '@mui/material/styles';

import { RouterLink } from 'src/routes/components';

import { logoClasses } from './classes';

// ----------------------------------------------------------------------

const LOGO_FULL = '/assets/viva-logo-full.png';
const LOGO_MARK = '/assets/viva-logo-mark.png';

export type LogoProps = LinkProps & {
  /** Render the square "M" mark instead of the full wordmark. */
  isSingle?: boolean;
  disabled?: boolean;
};

export function Logo({
  sx,
  disabled,
  className,
  href = '/',
  isSingle = false,
  ...other
}: LogoProps) {
  return (
    <LogoRoot
      component={RouterLink}
      href={href}
      aria-label="VivaMama"
      underline="none"
      className={mergeClasses([logoClasses.root, className])}
      sx={[
        {
          width: '100%',
          height: 34,
          ...(isSingle && { width: 40, height: 40 }),
          ...(disabled && { pointerEvents: 'none' }),
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      <Box
        component="img"
        alt="VivaMama"
        src={isSingle ? LOGO_MARK : LOGO_FULL}
        sx={{ width: 1, height: 1, objectFit: 'contain', objectPosition: 'center center' }}
      />
    </LogoRoot>
  );
}

// ----------------------------------------------------------------------

const LogoRoot = styled(Link)(() => ({
  flexShrink: 0,
  color: 'transparent',
  display: 'inline-flex',
  verticalAlign: 'middle',
}));
