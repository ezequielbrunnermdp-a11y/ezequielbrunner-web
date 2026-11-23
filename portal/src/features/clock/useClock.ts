import { useQuery } from '@tanstack/react-query';
import { rpc } from '@/lib/supabase';
import type { ClockStatus } from '@/lib/types';

export const useClockStatus = () =>
  useQuery({ queryKey: ['clock-status'], queryFn: () => rpc<ClockStatus>('my_clock_status'), refetchInterval: 60_000 });
