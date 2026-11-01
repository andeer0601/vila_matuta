import {DEMO_MODE} from './mode';
import {api} from './api';
import {assertUserManagement} from './access';
import {demoLock,readLocal,writeLocal} from './operations';
import {DEMO_PROFILES} from './supabase/mock-data';
import type {Profile} from '@/types/database';
export type ManagedUser=Pick<Profile,'id'|'full_name'|'role'|'disabled_at'>;
export async function listUsers():Promise<ManagedUser[]>{
 if(!DEMO_MODE)return (await api('/api/users')).users;
 return Object.values({...DEMO_PROFILES,...readLocal<Record<string,Profile>>('vm_profiles',{})});
}
export async function setUserAccess(actor:Profile,targetId:string,disabled:boolean){
 if(!DEMO_MODE)return api('/api/users',{targetId,disabled});
 return demoLock(()=>{
  const profiles={...DEMO_PROFILES,...readLocal<Record<string,Profile>>('vm_profiles',{})};
  const target=profiles[targetId];if(!target||!profiles[actor.id])throw new Error('Usuário indisponível.');
  assertUserManagement(profiles[actor.id],target);
  profiles[targetId]={...target,disabled_at:disabled?new Date().toISOString():null};
  writeLocal('vm_profiles',profiles);
 });
}
