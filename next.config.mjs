import demoEnvironment from './scripts/demo-environment.cjs';
if(process.env.NEXT_PUBLIC_DEMO_MODE==='true'){
 const errors=demoEnvironment.demoEnvironmentErrors(process.env);
 if(errors.length)throw new Error(errors.join('\n'));
}
/** @type {import('next').NextConfig} */
const nextConfig = {
 reactStrictMode:true,
 poweredByHeader:false,
 async headers(){return [{source:'/(.*)',headers:[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
 ]}];},
};
export default nextConfig;
