import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-center gap-8 px-4 py-12 sm:px-8">
      <p className="kicker">Gulliver · tour intelligence</p>
      <h1 className="poster text-[clamp(4.5rem,15vw,11rem)]">
        Every city,
        <br />
        <span className="text-signal">sized up.</span>
      </h1>
      <p className="max-w-xl text-lg text-ink-soft">
        For promoters, venues and talent agents: the markets, support acts and brands that share an act&apos;s
        audience taste, from aggregate affinity data in Qloo&apos;s taste graph. It doesn&apos;t forecast ticket sales
        or describe any individual fan.
      </p>
      <div>
        <Link href="/board" className="btn btn-signal">
          Open your tour board
        </Link>
      </div>
    </main>
  );
}
