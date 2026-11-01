import {UserDetails} from '@/components/UserDetails';
export default async function UserPage({params}:{params:Promise<{id:string}>}){return <UserDetails id={(await params).id}/>;}
