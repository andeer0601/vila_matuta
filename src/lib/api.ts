import { createClient } from '@/lib/supabase/client';
export async function api(path: string, body?: unknown, method?: string) {
  const { data: { session } } = await createClient().auth.getSession();
  const response = await fetch(path, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: 'Bearer '+session.access_token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache:'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
  return data;
}
