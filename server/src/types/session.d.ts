// 세션 타입 증강
import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: string;
    isAdmin: boolean;
  }
}
