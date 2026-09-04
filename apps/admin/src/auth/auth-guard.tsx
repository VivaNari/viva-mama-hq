import { Navigate } from 'react-router-dom';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

import { useAuth } from './auth-context';

// ----------------------------------------------------------------------

const renderLoading = () => (
  <Box
    sx={{
      display: 'flex',
      minHeight: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <CircularProgress />
  </Box>
);

/** Keeps the dashboard behind a validated session. */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();

  // Must wait: rendering the redirect while the stored token is still being validated
  // would bounce a signed-in administrator to /sign-in on every hard refresh.
  if (loading) {
    return renderLoading();
  }

  if (!admin) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
}

/** Keeps an already-signed-in administrator off the sign-in page. */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { admin, loading } = useAuth();

  if (loading) {
    return renderLoading();
  }

  if (admin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
