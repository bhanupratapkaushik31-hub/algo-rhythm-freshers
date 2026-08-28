import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const response = NextResponse.redirect(`${appUrl}/my-ticket`);
  
  response.cookies.delete('student_email');
  response.cookies.delete('student_ticket_token');
  
  return response;
}

export async function POST(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const response = NextResponse.redirect(`${appUrl}/my-ticket`);
  
  response.cookies.delete('student_email');
  response.cookies.delete('student_ticket_token');
  
  return response;
}

export const dynamic = 'force-dynamic';
