// app/page.tsx  — SERVER wrapper (no "use client" here)
export const dynamic = "force-dynamic";
export const revalidate = 0;

import HomeClient from "./home-client";

export default function Page() {
  return <HomeClient />;
}
