import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 dark:bg-black">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">Teriyaki POS</h1>
      <div className="flex gap-4">
        <Link
          href="/kiosk"
          className="rounded-full bg-foreground px-8 py-3 text-lg font-medium text-background"
        >
          Kiosk
        </Link>
        <Link
          href="/kitchen"
          className="rounded-full border border-black/[.08] px-8 py-3 text-lg font-medium dark:border-white/[.145]"
        >
          Kitchen display
        </Link>
      </div>
    </div>
  );
}
