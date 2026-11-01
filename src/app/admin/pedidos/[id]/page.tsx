import {OrderDetails} from '@/components/OrderDetails';
export default async function OrderPage({params}:{params:Promise<{id:string}>}){return <OrderDetails id={(await params).id}/>;}
