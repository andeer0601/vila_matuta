// Shared by Next.js startup/build and the deployment preflight. Never print values.
function demoEnvironmentErrors(env) {
 const forbidden=['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','INFINITEPAY_HANDLE','NEXT_PUBLIC_TURNSTILE_SITE_KEY','DATA_ENCRYPTION_KEYS','RATE_LIMIT_SECRET'];
 const configured=[...new Set([...forbidden,...Object.keys(env).filter(key=>key.startsWith('NEXT_PUBLIC_')&&key!=='NEXT_PUBLIC_DEMO_MODE')])].filter(key=>!!env[key]);
 const errors=[];
 if(configured.length)errors.push('Demo requires empty service credentials. Configured keys: '+configured.join(', '));
 if(env.PAYMENTS_ENABLED!=='false')errors.push('Demo requires PAYMENTS_ENABLED=false explicitly.');
 return errors;
}
module.exports={demoEnvironmentErrors};
