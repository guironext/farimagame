import { Suspense } from "react";
import { GameClient } from "@/components/GameClient";
import { Spinner } from "@/components/ui";

export const metadata = { title: "Partie – FarimaGame" };

async function Game({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GameClient id={id} />;
}

export default function Page({ params }: PageProps<"/jeu/[id]">) {
  return (
    <Suspense fallback={<Spinner label="Chargement de la table…" />}>
      <Game params={params} />
    </Suspense>
  );
}
