import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { LIMITS, type Plan, type UsageField } from './limits';
import { supabase } from './supabase';

type Usage = Record<UsageField, number> & { cost_usd: number };
type Account = {
  session: Session | null;
  loading: boolean;
  plan: Plan;
  trialEndsAt: string | null;
  onboarded: boolean | null;
  usage: Usage;
  limits: (typeof LIMITS)[Plan];
  refresh: () => Promise<void>;
};

const emptyUsage: Usage = { uploads: 0, tutor_messages: 0, weekly_sheets: 0, exam_sheets: 0, papers: 0, cost_usd: 0 };
const Ctx = createContext<Account | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Plan>('free');
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [usage, setUsage] = useState<Usage>(emptyUsage);
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(async () => {
    if (!session) return;
    const month = new Date().toISOString().slice(0, 7);
    const [{ data: s }, { data: u }, { data: p }] = await Promise.all([
      supabase.from('subscriptions').select('plan, trial_ends_at').maybeSingle(),
      supabase.from('usage').select('*').eq('month', month).maybeSingle(),
      supabase.from('profiles').select('onboarded').maybeSingle(),
    ]);
    setOnboarded(p ? !!p.onboarded : true);
    const isPro = s?.plan === 'pro' || (s?.plan === 'trial' && s.trial_ends_at && new Date(s.trial_ends_at) > new Date());
    setPlan(isPro ? 'pro' : 'free');
    setTrialEndsAt(s?.plan === 'trial' ? s.trial_ends_at : null);
    setUsage(u ? { ...emptyUsage, ...u } : emptyUsage);
  }, [session]);

  useEffect(() => { if (session) refresh(); else setOnboarded(null); }, [refresh, session]);

  return (
    <Ctx.Provider value={{ session, loading: loading || (!!session && onboarded === null), plan, trialEndsAt, onboarded, usage, limits: LIMITS[plan], refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAccount() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAccount must be used inside AuthProvider');
  return v;
}
