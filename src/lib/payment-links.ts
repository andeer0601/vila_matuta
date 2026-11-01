export function validPaymentUrl(value:unknown):value is string{
 if(typeof value!=='string')return false;
 try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&(!url.port||url.port==='443')&&(url.hostname==='infinitepay.io'||url.hostname.endsWith('.infinitepay.io'));}catch{return false;}
}
export function paymentLinkState(row:{status:string;checkout_url?:string|null;checkout_claimed_at?:string|null;checkout_single_payment?:boolean;checkout_expires_at?:string|null},now=Date.now()):'none'|'ready'|'expired'|'review'{
 if(row.status!=='pending')return 'none';
 if(!row.checkout_url)return row.checkout_claimed_at?'review':'none';
 if(!validPaymentUrl(row.checkout_url)||!row.checkout_single_payment||!row.checkout_expires_at||!Number.isFinite(Date.parse(row.checkout_expires_at)))return 'review';
 return Date.parse(row.checkout_expires_at)>now?'ready':'expired';
}
