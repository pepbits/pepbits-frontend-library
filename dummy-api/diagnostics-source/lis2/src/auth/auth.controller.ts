import { Body, Controller, Get, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Db } from '../db/database.service';
import { CurrentUser, Public, SessionUser } from '../common/auth';
import { newToken, verifyPassword } from '../common/crypto';

@Controller('auth')
export class AuthController {
  constructor(private readonly db: Db) {}

  @Public()
  @Post('login')
  login(@Body() body: { username: string; password: string }) {
    const u = this.db.get('SELECT * FROM users WHERE username = ? AND active = 1', String(body?.username || '').trim());
    if (!u || !verifyPassword(String(body?.password || ''), u.password_hash)) throw new UnauthorizedException('Incorrect username or password');
    const token = newToken();
    this.db.run("INSERT INTO sessions(token, user_id, expires_at) VALUES (?, ?, datetime('now', '+12 hours'))", token, u.id);
    this.db.run("DELETE FROM sessions WHERE expires_at < datetime('now')");
    this.db.audit(u.id, 'LOGIN', 'users', u.id);
    return { token, user: { id: u.id, username: u.username, full_name: u.full_name, role: u.role } };
  }

  @Get('me')
  me(@CurrentUser() u: SessionUser) {
    return u;
  }

  @Post('logout')
  logout(@Req() req: any) {
    const token = String(req.headers.authorization || '').replace('Bearer ', '');
    this.db.run('DELETE FROM sessions WHERE token = ?', token);
    return { ok: true };
  }
}
