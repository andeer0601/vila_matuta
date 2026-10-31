import {NextRequest,NextResponse} from 'next/server';
import {productionAvailability,database,failure} from '@/lib/server/database';
import {clientAddress,rateLimit} from '@/lib/server/rate-limit';
export async function GET(req:NextRequest){try{await rateLimit(database(),'availability',clientAddress(req),120,60);return NextResponse.json(await productionAvailability(),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
