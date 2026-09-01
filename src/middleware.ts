import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Standard Next.js Middleware for Server-Side Route Protection.
 * Protects administrative and coordinator pages against unauthenticated access.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login pages through
  if (pathname === '/admin/login' || pathname === '/coordinator/login') {
    return NextResponse.next();
  }

  // Protect all /admin routes
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('sb-access-token')?.value;

    if (!token) {
      const loginUrl = new URL('/admin/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Protect all /coordinator routes
  if (pathname.startsWith('/coordinator')) {
    const token = request.cookies.get('sb-access-token')?.value;

    if (!token) {
      const loginUrl = new URL('/coordinator/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/coordinator/:path*'
  ],
};
