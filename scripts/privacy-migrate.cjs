// Offline maintenance command; stop writes and back up the database before --apply.
const fs=require('node:fs');const path=require('node:path');const Module=require('node:module');const ts=require('typescript');
require('@next/env').loadEnvConfig(process.cwd());
const {createClient}=require('@supabase/supabase-js');
const filename=path.resolve('src/lib/server/privacy.ts');const code=ts.transpileModule(fs.readFileSync(filename,'utf8').replace("import 'server-only';",''),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;mod._compile(code,filename);const {protect,reveal}=mod.exports;
const apply=process.argv.includes('--apply');const rotate=process.argv.includes('--rotate');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const personal=['full_name','phone','avatar_url','cep','street','number','neighborhood','complement','city','state','dietary_restrictions','dietary_notes'];
const privateFields=new Set([...personal,'email','recipient_name','recipient_phone','special_instructions','specialInstructions','notes']);
function needs(value,sensitive=false){if(typeof value==='string')return sensitive&&value.length>0&&!value.startsWith('vmenc:1:');if(Array.isArray(value))return value.some(v=>needs(v,sensitive));if(value&&typeof value==='object')return Object.entries(value).some(([k,v])=>needs(v,sensitive||privateFields.has(k)));return false;}
async function run(){protect({},'configuration-check');for(const table of ['profiles','saved_addresses','meal_purchases','orders','order_items']){
 let after=null,changed=0;while(true){let q=db.from(table).select('*').order('id').limit(100);if(after)q=q.gt('id',after);const {data,error}=await q;if(error)throw new Error('Read failed: '+table);if(!data.length)break;
 for(const row of data){let owner=row.user_id||row.id;let selected;
 if(table==='profiles')selected=Object.fromEntries(personal.map(k=>[k,row[k]]));
 else if(table==='saved_addresses')selected={address:row.address};
 else if(table==='meal_purchases')selected={payload:row.payload};
 else if(table==='orders')selected={shipping_address_snapshot:row.shipping_address_snapshot,notes:row.notes};
 else{const {data:order,error}=await db.from('orders').select('user_id').eq('id',row.order_id).single();if(error)throw new Error('Missing legacy order');owner=order.user_id;selected={special_instructions:row.special_instructions};}
 // Re-encrypting structured payloads is safe but rewrites existing ciphertext. Keep it intentional.
 const plain=reveal(selected,owner);if(!rotate&&!needs(selected)&&!(table==='profiles'&&row.email!==row.id+'@auth.invalid'))continue;
 const update=protect(plain,owner);if(table==='profiles')update.email=row.id+'@auth.invalid';changed++;
 if(apply){const {error}=await db.from(table).update(update).eq('id',row.id);if(error)throw new Error('Write failed: '+table);}
 }after=data.at(-1).id;
 }console.log(table+': '+changed+' records '+(apply?'protected':'to process (dry run)'));}
 console.log(apply?'Migration complete. Keep old encryption keys for backups.':'No data changed. Run with --apply during a maintenance window.');}
run().catch(()=>{console.error('Migration stopped. Verify keys, database permissions and backups. No personal data or secrets are printed.');process.exitCode=1;});
