import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#2c2c29] bg-[#1b1b1b]/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/images/foothold-mark.png"
            alt="Foothold Systems logo"
            width={32}
            height={32}
            className="h-8 w-8 rounded-md"
            priority
          />
          <span className="font-mono text-sm font-bold uppercase tracking-[0.16em] text-[#f2efe6]">
            Foothold Systems
          </span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link
            href="/#how-we-work"
            className="hidden font-mono text-xs uppercase tracking-[0.14em] text-[#cfccc2] transition-colors hover:text-[#f2efe6] sm:inline"
          >
            How we work
          </Link>
          <Link
            href="/guide"
            className="hidden font-mono text-xs uppercase tracking-[0.14em] text-[#cfccc2] transition-colors hover:text-[#f2efe6] sm:inline"
          >
            The guide
          </Link>
          <Link
            href="/guide#get-the-guide"
            className="rounded-lg bg-[#f6be00] px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#1b1b1b] transition-colors hover:bg-[#ffd23d]"
          >
            Free guide
          </Link>
        </nav>
      </div>
    </header>
  );
}
