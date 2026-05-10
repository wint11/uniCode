import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';

// 模板项目：硬编码用户（生产环境替换为数据库验证）
const USERS: Record<string, { password: string; role: string }> = {
  admin: { password: 'admin123', role: 'admin' },
  reviewer: { password: 'review123', role: 'reviewer' },
};

const JWT_SECRET = new TextEncoder().encode(
  process.env.APP_SECRET || 'unicode-dev-secret-change-in-production',
);

export async function POST(req: Request) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
  }

  const user = USERS[username];
  if (!user || user.password !== password) {
    return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
  }

  // 签发 JWT（24 小时有效）
  const token = await new SignJWT({ username, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);

  const response = NextResponse.json({ success: true, role: user.role });
  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  });

  return response;
}
