import { SvgColor } from 'src/components/svg-color';

// ----------------------------------------------------------------------

const icon = (name: string) => <SvgColor src={`/assets/icons/navbar/${name}.svg`} />;

export type NavItem = {
  title: string;
  path: string;
  icon: React.ReactNode;
  info?: React.ReactNode;
};

/**
 * Only the surfaces that are actually built. Users, Contents, Products, Experts
 * and Viva Circle all pointed at the same placeholder route; their pages still exist
 * and remain reachable by URL, they are simply not advertised yet.
 */
export const navData: NavItem[] = [
  {
    title: 'Dashboard',
    path: '/',
    icon: icon('ic-analytics'),
  },
  {
    title: 'Consultations',
    path: '/consultations',
    icon: icon('ic-blog'),
  },
  // Reachable from the sidebar rather than by URL only: reports that nobody opens are
  // the failure mode Play's "ongoing moderation" requirement is written against.
  // Reuses ic-user because only three icons ship in public/assets/icons/navbar — a
  // name with no file behind it renders as a blank square.
  {
    title: 'Moderation',
    path: '/moderation',
    icon: icon('ic-user'),
  },
];
