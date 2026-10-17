import { Iconify } from 'src/components/iconify';

import type { AccountPopoverProps } from './components/account-popover';

// ----------------------------------------------------------------------

// Only the surfaces that exist. Settings and the mothers directory are not built yet
// and would have been dead links.
export const _account: AccountPopoverProps['data'] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: <Iconify width={22} icon="solar:home-angle-bold-duotone" />,
  },
  {
    label: 'Consultations',
    href: '/consultations',
    icon: <Iconify width={22} icon="solar:chat-round-dots-bold" />,
  },
  {
    label: 'Moderation',
    href: '/moderation',
    icon: <Iconify width={22} icon="solar:shield-keyhole-bold-duotone" />,
  },
];
