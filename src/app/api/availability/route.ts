import {NextRequest,NextResponse} from 'next/server';
import {availability,database,failure} from '@/lib/server/database';
import {clientAddress,rateLimit} from '@/lib/server/rate-limit';
export async function GET(req:NextRequest){try{await rateLimit(database(),'availability',clientAddress(req),120,60);return NextResponse.json({capacity:await availability()},{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
