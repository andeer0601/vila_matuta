import 'server-only';
import {validPaymentUrl} from './payment-links';
import {DEMO_MODE} from './mode';
const BASE='https://api.checkout.infinitepay.io';
function config() {
  if(DEMO_MODE)throw new Error('Pagamentos reais desativados nesta demonstração.');
  const handle=process.env.INFINITEPAY_HANDLE,site=process.env.APP_URL;
  if(process.env.PAYMENTS_ENABLED!=='true'||!handle||!site||!site.startsWith('https://'))throw new Error('O pagamento online ainda não está habilitado.');
  return {handle,site:site.replace(/\/$/,'')};
}
async function post(path:string,payload:unknown) {
  if(DEMO_MODE)throw new Error('Pagamentos reais desativados nesta demonstração.');
  const response=await fetch(BASE+path,{method:'POST',headers:{'Content-Type':'application/json',...(process.env.INFINITEPAY_API_KEY?{'X-Api-Key':process.env.INFINITEPAY_API_KEY}:{})},body:JSON.stringify(payload),signal:AbortSignal.timeout(12000),cache:'no-store'});
  if(!response.ok)throw new Error('A InfinitePay não respondeu. Tente novamente em instantes.');
  return response.json();
}
export async function createInfinitePayCharge(order:{id:string;total_amount:number;quantity_meals:number},customer:{name:string;email:string},expiresAt:string) {
  const {handle,site}=config();
  if(!process.env.INFINITEPAY_API_KEY||!Number.isFinite(Date.parse(expiresAt))||Date.parse(expiresAt)<=Date.now())throw new Error('Pagamento seguro não configurado. Fale com a equipe.');
  const result=await post('/links',{handle,order_nsu:order.id,options:{single_payment:true,valid_until:expiresAt},items:[{quantity:1,price:Math.round(order.total_amount*100),description:order.quantity_meals+' marmitas artesanais — Vila Matuta'}],customer,redirect_url:site+'/checkout/'+order.id,webhook_url:site+'/api/webhooks/infinitepay'});
  if(!validPaymentUrl(result.url))throw new Error('Link de pagamento inválido.');
  return result.url as string;
}
export async function verifyInfinitePayPayment(orderId:string,transaction:string,slug:string) {
  const handle=process.env.INFINITEPAY_HANDLE;
  if(!handle)throw new Error('Conta de pagamento não configurada.');
  return post('/payment_check',{handle,order_nsu:orderId,transaction_nsu:transaction,slug});
}
