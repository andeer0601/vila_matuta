import 'server-only';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
// Only operational personal fields are encrypted. IDs, dates, amounts and menu data remain queryable.
const privateFields=new Set(['full_name','phone','avatar_url','email','cep','street','number','neighborhood','complement','city','state','recipient_name','recipient_phone','dietary_restrictions','dietary_notes','special_instructions','specialInstructions','notes']);
const PREFIX='vmenc:1:';
function keys(){
 const raw=process.env.DATA_ENCRYPTION_KEYS,active=process.env.DATA_ENCRYPTION_ACTIVE_KEY;
 if(!raw||!active)throw new Error('PRIVACY_CONFIG');
 let parsed:Record<string,string>;try{parsed=JSON.parse(raw);}catch{throw new Error('PRIVACY_CONFIG');}
 if(!/^[a-zA-Z0-9_-]{1,32}$/.test(active)||!parsed[active])throw new Error('PRIVACY_CONFIG');
 const ring=new Map<string,Buffer>();for(const [id,value] of Object.entries(parsed)){if(typeof value!=='string')throw new Error('PRIVACY_CONFIG');const key=Buffer.from(value,'base64');if(key.length!==32||key.toString('base64')!==value)throw new Error('PRIVACY_CONFIG');ring.set(id,key);}return {active,ring};
}
function seal(value:string,owner:string){const {active,ring}=keys();const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',ring.get(active)!,iv);cipher.setAAD(Buffer.from('vila-matuta:'+owner));const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return PREFIX+[active,iv.toString('base64'),cipher.getAuthTag().toString('base64'),data.toString('base64')].join(':');}
function unseal(value:string,owner:string){
 if(!value.startsWith(PREFIX))return value; // Allows migration of pre-existing records; all new writes are sealed.
 const [id,iv,tag,data,...extra]=value.slice(PREFIX.length).split(':');const {ring}=keys();const key=ring.get(id);if(!key||extra.length||!iv||!tag||data===undefined)throw new Error('PRIVACY_DECRYPT');
 try{const ivBytes=Buffer.from(iv,'base64'),tagBytes=Buffer.from(tag,'base64');if(ivBytes.length!==12||tagBytes.length!==16)throw new Error();const decipher=createDecipheriv('aes-256-gcm',key,ivBytes);decipher.setAAD(Buffer.from('vila-matuta:'+owner));decipher.setAuthTag(tagBytes);return Buffer.concat([decipher.update(Buffer.from(data,'base64')),decipher.final()]).toString('utf8');}catch{throw new Error('PRIVACY_DECRYPT');}
}
function transform(value:unknown,owner:string,mode:'seal'|'open',privateValue=false):unknown{
 if(typeof value==='string')return privateValue?(mode==='seal'?seal(value,owner):unseal(value,owner)):value;
 if(Array.isArray(value))return value.map(v=>transform(v,owner,mode,privateValue));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,transform(v,owner,mode,privateValue||privateFields.has(k))]));
 return value;
}
export function protect<T>(value:T,owner:string):T{keys();return transform(value,owner,'seal') as T;}
export function reveal<T>(value:T,owner:string):T{return transform(value,owner,'open') as T;}
