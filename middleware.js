import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

async function fetchSession(req) {
  try {
    const url = new URL('/api/auth/session', req.url);
    const res = await fetch(url.toString(), {
      headers: { cookie: req.headers.get('cookie') || '' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (e) {
    return null;
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // Allow API and static paths immediately
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static')
  ) {
    return NextResponse.next();
  }

  // Redirect authenticated users away from login
  if (pathname === '/login') {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token) {
      if (token.role === 'ADMIN') return NextResponse.redirect(new URL('/admin', req.url));
      if (token.role === 'PARENT') return NextResponse.redirect(new URL('/parent', req.url));
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }
    return NextResponse.next();
  }

  // Try token first (fast)
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  // Helper to check role, accepts token or session object
  const checkRole = (roleNeeded, source) => {
    if (!source) return false;
    const role = source.role || (source.user && source.user.role);
    return role === roleNeeded;
  };

  const loginRedirect = NextResponse.redirect(new URL('/login', req.url));

  // Admin area
  if (pathname.startsWith('/admin')) {
    if (token && checkRole('ADMIN', token)) return NextResponse.next();

    const session = await fetchSession(req);
    if (session && checkRole('ADMIN', session)) return NextResponse.next();

    return loginRedirect;
  }

  // Dashboard (students)
  if (pathname.startsWith('/dashboard')) {
    if (token && checkRole('STUDENT', token)) return NextResponse.next();

    const session = await fetchSession(req);
    if (session && checkRole('STUDENT', session)) return NextResponse.next();

    return loginRedirect;
  }

  // Parent area
  if (pathname.startsWith('/parent')) {
    if (token && checkRole('PARENT', token)) return NextResponse.next();

    const session = await fetchSession(req);
    if (session && checkRole('PARENT', session)) return NextResponse.next();

    return loginRedirect;
  }

  // Subjects pages require any authenticated user
  if (pathname.startsWith('/subjects')) {
    if (token) return NextResponse.next();

    const session = await fetchSession(req);
    if (session) return NextResponse.next();

    return loginRedirect;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/parent/:path*', '/((?!api|_next|static).*)'],
};
