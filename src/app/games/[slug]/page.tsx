import { notFound } from "next/navigation";
import { FatherdleApp } from "@/components/FatherdleApp";
import { ACTIVE_GAME_SLUGS } from "@/lib/constants";
import type { GameSlug } from "@/lib/types";

export function generateStaticParams() {
  return ACTIVE_GAME_SLUGS.map((slug) => ({ slug }));
}

export default async function GamePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!ACTIVE_GAME_SLUGS.includes(slug as GameSlug)) notFound();
  return <FatherdleApp initialTab="games" initialGameSlug={slug as GameSlug} />;
}
