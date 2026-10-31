import { NextResponse } from 'next/server';
// Access control is enforced by the auth.users trigger, never by a public email lookup.
export async function POST(){return NextResponse.json({error:'Use o formulário de acesso. O cadastro é restrito a e-mails convidados.'},{status:403});}
