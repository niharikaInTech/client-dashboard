import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/ApiError";
import { validate } from "../middleware/validate";
import { authenticate } from "../middleware/auth";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../lib/jwt";
import { env } from "../config/env";

const router = Router();

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

const REFRESH_COOKIE = "refresh_token";

const cookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: env.refreshTokenTtlMs,
};

async function issueTokens(userId: string, role: string) {
  const record = await prisma.refreshToken.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + env.refreshTokenTtlMs),
    },
  });

  const accessToken = signAccessToken({ sub: userId, role: role as any });
  const refreshToken = signRefreshToken({ sub: userId, jti: record.id });
  return { accessToken, refreshToken };
}

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw ApiError.unauthorized("Invalid email or password");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw ApiError.unauthorized("Invalid email or password");

    const { accessToken, refreshToken } = await issueTokens(user.id, user.role);

    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  })
);

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw ApiError.unauthorized("No refresh token");

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw ApiError.unauthorized("Refresh token is invalid or expired");
    }

    const stored = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw ApiError.unauthorized("Refresh token has been revoked");
    }

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) throw ApiError.unauthorized();

    // Rotate: revoke the old row and issue a brand new one, so a stolen
    // refresh cookie that gets reused after the legitimate client rotates it
    // is immediately detectable (both would try to use a revoked id).
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const { accessToken, refreshToken } = await issueTokens(user.id, user.role);
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions);
    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  })
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        await prisma.refreshToken.update({
          where: { id: payload.jti },
          data: { revokedAt: new Date() },
        }).catch(() => undefined);
      } catch {
        // token already invalid, nothing to revoke
      }
    }
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.status(204).send();
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw ApiError.notFound("User not found");
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  })
);

export default router;
export { REFRESH_COOKIE };
