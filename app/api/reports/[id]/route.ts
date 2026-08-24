import { NextResponse } from 'next/server'; import { report } from '@/lib/store';
export async function GET(_: Request, { params }: { params: Promise<{id:string}> }) { const item=await report((await params).id); return item ? NextResponse.json(item) : NextResponse.json({error:'Not found'},{status:404}); }
