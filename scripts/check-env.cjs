require('@next/env').loadEnvConfig(process.cwd());
if(process.env.NEXT_PUBLIC_DEMO_MODE==='true'){
 require('./demo-environment.cjs').stripDemoPlatformMetadata(process.env);
 const errors=require('./demo-environment.cjs').demoEnvironmentErrors(process.env);
 if(errors.length){console.error(errors.join('\n'));process.exit(1);}
 console.log('Public demo configuration validated: local fictional profiles, no real integrations. Use the same flags at build and runtime, a separate HTTPS hostname and no production data.');process.exit(0);
}
const errors=[];const required=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','APP_URL','DATA_ENCRYPTION_KEYS','DATA_ENCRYPTION_ACTIVE_KEY','RATE_LIMIT_SECRET'];for(const key of required)if(!process.env[key])errors.push(key+' missing');
for(const key of ['NEXT_PUBLIC_SUPABASE_URL','APP_URL'])try{if(new URL(process.env[key]).protocol!=='https:')errors.push(key+' must use HTTPS');}catch{errors.push(key+' invalid');}
if((process.env.RATE_LIMIT_SECRET||'').length<32)errors.push('RATE_LIMIT_SECRET must have at least 32 characters');
try{const keys=JSON.parse(process.env.DATA_ENCRYPTION_KEYS);if(!keys[process.env.DATA_ENCRYPTION_ACTIVE_KEY])errors.push('Active encryption key missing');for(const value of Object.values(keys))if(typeof value!=='string'||Buffer.from(value,'base64').length!==32||Buffer.from(value,'base64').toString('base64')!==value)errors.push('Encryption keys must encode 32 bytes');}catch{errors.push('DATA_ENCRYPTION_KEYS invalid');}
if(!['netlify','vercel'].includes(process.env.TRUSTED_PROXY))errors.push('Configure TRUSTED_PROXY for the deployment (otherwise all users share an IP bucket)');
if(!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)errors.push('Enable Turnstile for production and configure the secret in Supabase Auth');
if(process.env.NEXT_PUBLIC_DEMO_MODE!=='false')errors.push('Set NEXT_PUBLIC_DEMO_MODE=false in deployed environments');
const publicAllowed=new Set(['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','NEXT_PUBLIC_DEMO_MODE','NEXT_PUBLIC_TURNSTILE_SITE_KEY']);for(const key of Object.keys(process.env))if(key.startsWith('NEXT_PUBLIC_')&&!publicAllowed.has(key))errors.push('Review unexpected public environment variable: '+key);
if(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY===process.env.SUPABASE_SERVICE_ROLE_KEY&&process.env.SUPABASE_SERVICE_ROLE_KEY)errors.push('Service key must NEVER be the public key');
if(process.env.PAYMENTS_ENABLED==='true'&&!process.env.INFINITEPAY_API_KEY)errors.push('INFINITEPAY_API_KEY missing for single-use expiring links');
if(process.env.PAYMENTS_ENABLED==='true'&&!process.env.INFINITEPAY_HANDLE)errors.push('INFINITEPAY_HANDLE missing');
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log('Environment structure validated. Also verify Supabase CAPTCHA, RLS, SMTP, backups and WAF settings in their dashboards.');
