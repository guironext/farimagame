import { Suspense } from "react";
import { MatchClient } from "@/components/paris/MatchClient";
import { Spinner } from "@/components/ui";

export const metadata = { title: "Match – Paris sportifs – FarimaGame" };

async function Match({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatchClient id={id} />;
}

export default function Page({ params }: PageProps<"/paris/match/[id]">) {
  return (
    <Suspense fallback={<Spinner label="Chargement du match…" />}>
      <Match params={params} />
    </Suspense>
  );
}
