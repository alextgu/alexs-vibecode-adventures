import { clerkMiddleware } from "@clerk/nextjs/server";

// Everything is public at the routing level. Write-side authorization
// (admin email check) lives in the server actions in src/lib/challenges.ts.
export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)",
    "/(api|trpc)(.*)",
  ],
};
