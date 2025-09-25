export { default } from "@supabase/auth-helpers-nextjs/edge-middleware";
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
