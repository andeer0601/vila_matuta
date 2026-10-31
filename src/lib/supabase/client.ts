import {DEMO_MODE} from '../mode';
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  if(DEMO_MODE)throw new Error('Autenticação real desativada nesta demonstração.');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
