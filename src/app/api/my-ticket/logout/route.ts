import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const redirectUrl = new URL('/my-ticket', request.url);
  const response = NextResponse.redirect(redirectUrl);
  
  response.cookies.delete('ticket_access_session');
  response.cookies.delete('student_phone');
  response.cookies.delete('student_ticket_token');
  
  return response;
}

export async function POST(request: NextRequest) {
  const redirectUrl = new URL('/my-ticket', request.url);
  const response = NextResponse.redirect(redirectUrl);
  
  response.cookies.delete('ticket_access_session');
  response.cookies.delete('student_phone');
  response.cookies.delete('student_ticket_token');
  
  return response;
}

export const dynamic = 'force-dynamic';
