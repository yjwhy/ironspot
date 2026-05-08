import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

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
    } = supabase.auth.onAuthStateChange((_, session) => {
      setState(session ? { status: 'authenticated', session } : { status: 'anonymous' });
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
