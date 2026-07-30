import Image from "next/image";
import Link from "next/link";
import { BookCallButton } from "@/components/BookCallButton";

export function Footer() {
  return (
    <footer className="border-t border-[#2c2c29] bg-[#1b1b1b] text-[#cfccc2]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-14 sm:flex-row sm:justify-between">
        <div>
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/images/foothold-mark.png"
              alt="Foothold Systems logo"
              width={32}
              height={32}
              className="h-8 w-8 rounded-md"
            />
            <span className="font-mono text-sm font-bold uppercase tracking-[0.16em] text-[#f2efe6]">
              Foothold Systems
            </span>
          </Link>
          <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-[#7a786f]">
            AI for Small Business
          </p>
        </div>

        <div className="flex flex-col gap-6 sm:flex-row sm:gap-16">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#7a786f]">
              Explore
            </p>
            <ul className="mt-3 space-y-2 font-serif text-[15px]">
              <li>
                <Link href="/#how-we-work" className="transition-colors hover:text-[#f2efe6]">
                  How we work
                </Link>
              </li>
              <li>
                <Link href="/guide" className="transition-colors hover:text-[#f2efe6]">
                  The 5 Levels of AI
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#7a786f]">
              Get in touch
            </p>
            {/* Booking only — no phone or email published while inbound is
                being kept to scheduled calls. */}
            <ul className="mt-3 space-y-2 font-serif text-[15px]">
              <li>
                <BookCallButton
                  entryPoint="footer"
                  className="transition-colors hover:text-[#f2efe6]"
                >
                  Book a call
                </BookCallButton>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-[#2c2c29]">
        <p className="mx-auto max-w-6xl px-6 py-5 font-mono text-[11px] uppercase tracking-[0.12em] text-[#57564f]">
          &copy; {new Date().getFullYear()} Foothold Systems
        </p>
      </div>
    </footer>
  );
}
