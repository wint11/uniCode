import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.APP_SECRET || 'unicode-dev-secret-change-in-production',
);

// 无需认证即可访问的路由
const PUBLIC_PATHS = ['/login', '/api/auth/login', '/'];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 公开路径跳过
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // /docs 及其子路由需要登录
  if (pathname === '/docs' || pathname.startsWith('/docs/')) {
    const token = req.cookies.get('session')?.value;

    if (!token) {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }

    try {
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.next();
    } catch {
      const loginUrl = new URL('/login', req.url);
      loginUrl.searchParams.set('from', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg).*)'],
};
