export default () => ({
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  aiServiceUrl: process.env.AI_SERVICE_URL ?? "http://localhost:5678",
  aiServiceTimeoutMs: Number(process.env.AI_SERVICE_TIMEOUT_MS ?? 60000),
  geminiApiKey: process.env.GEMINI_API_KEY,
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "15m",
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  refreshTokenCookieName:
    process.env.REFRESH_TOKEN_COOKIE_NAME ?? "refreshToken",
  passwordResetOtpTtlMinutes: Number(
    process.env.PASSWORD_RESET_OTP_TTL_MINUTES ?? 10,
  ),
  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from:
      process.env.SMTP_FROM ?? "Medical Consultation <no-reply@example.com>",
  },
});
