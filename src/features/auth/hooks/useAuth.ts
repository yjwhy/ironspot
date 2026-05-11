import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { setSentryUser } from '@/shared/lib/sentry';
import { supabase } from '@/shared/lib/supabase';

export type AuthState =
  | { status: 'loading' }
  | { status: 'authenticated'; session: Session }
  | { status: 'anonymous' };

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(function subscribeToAuthChanges() {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(function handleAuthChange(_, session) {
      // Attach user context to Sentry events (id only — PII minimisation per Task 31 #10).
      // Order is intentional: clear/set Sentry BEFORE setState so any exception thrown during
      // the render commit is attributed to the new auth identity. On logout this means a child
      // throw mid-transition is captured as anonymous rather than the prior user, which is the
      // safer side of the tradeoff (under-attribution > over-attribution for PII).
      if (session) {
        setSentryUser(session.user.id);
        setState({ status: 'authenticated', session });
      } else {
        setSentryUser(null);
        setState({ status: 'anonymous' });
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
