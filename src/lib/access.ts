import type {Profile} from '@/types/database';

export function assertCustomer(profile:Pick<Profile,'role'|'disabled_at'>|null){
 if(!profile)throw new Error('Entre na sua conta.');
 if(profile.disabled_at)throw new Error('Acesso desativado. Fale com a administração.');
 if(profile.role!=='customer')throw new Error('Pedidos são exclusivos de contas de clientes.');
}
export function assertUserManagement(actor:Pick<Profile,'id'|'role'|'disabled_at'>,target:Pick<Profile,'id'|'role'>){
 if(actor.role!=='admin'||actor.disabled_at)throw new Error('Acesso restrito.');
 if(actor.id===target.id)throw new Error('Você não pode alterar o acesso da própria conta.');
}
