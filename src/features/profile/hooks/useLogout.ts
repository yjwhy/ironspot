import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';
import { useState } from 'react';

import { supabase } from '@/shared/lib/supabase';

const LOGOUT_SUCCESS_TITLE = '로그아웃했습니다';
const LOGOUT_ERROR_TITLE = '로그아웃에 실패했습니다';

interface LogoutAction {
  handleLogout: () => Promise<void>;
  isPending: boolean;
}

export function useLogout(): LogoutAction {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      queryClient.clear();
      burnt.toast({ title: LOGOUT_SUCCESS_TITLE, preset: 'done' });
    } catch (e) {
      burnt.toast({ title: LOGOUT_ERROR_TITLE, preset: 'error' });
      throw e;
    } finally {
      setIsPending(false);
    }
  }

  return { handleLogout, isPending };
}
