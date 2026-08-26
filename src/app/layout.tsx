import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Archivo } from "next/font/google";
import Script from "next/script";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { RouteAnalytics } from "@/components/RouteAnalytics";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
});

// GA4 Measurement ID for THIS domain (footholdsystems.com), its own GA4
// property — kept separate from snaptechrepair.com's property so the two
// domains' traffic is never merged. Env var overrides the default if set.
const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "G-3G72HMB7VK";

// Microsoft Clarity — heatmaps and session replay. On a page this long, the
// scroll maps are the fastest read on which section is losing people.
const CLARITY_PROJECT_ID =
  process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID ?? "xurw6i8he8";

/**
 * Meta Pixel, from NEXT_PUBLIC_META_PIXEL_ID. No tag renders without it.
 *
 * There used to be a hardcoded ID here as a fallback, which is the wrong shape
 * of safety net: a missing pixel is visible the moment you look at Events
 * Manager and see nothing, while a *wrong* pixel looks exactly like a working
 * one and quietly files your conversions into somebody else's account. Silence
 * is the safer failure.
 *
 * Set in Production only, deliberately. Preview deployments and local runs
 * would otherwise fire PageView into the live pixel every time anyone opened
 * one, and paid optimisation is only as good as the data under it.
 *
 * Baked in at build time, as every NEXT_PUBLIC_ value is, so changing it in
 * Vercel does nothing until the next deployment.
 *
 * Read once because the ID is needed by both the init script and the
 * no-JavaScript fallback image, and updating one but not the other silently
 * splits tracking between two pixels.
 */
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export const metadata: Metadata = {
  // www, because the apex 308s to it. Canonical tags and og:url pointing at a
  // redirect send every share and every crawl through an extra hop, and paid
  // clicks land on the redirect rather than the page.
  metadataBase: new URL("https://www.footholdsystems.com"),
  title: {
    default: "FootHold AEO | Get Your Business Recommended by ChatGPT",
    template: "%s | FootHold AEO",
  },
  description:
    "Your customers are asking ChatGPT, Gemini and Perplexity who to hire, and the AI gives them one answer. FootHold AEO makes that answer your business. Free AI visibility scan.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "FootHold AEO",
    title: "When someone asks AI who to hire, one business gets named.",
    description:
      "There is no page two in an AI answer. One business gets recommended. FootHold AEO is how it becomes yours. Get a free scan of what the AIs say about you today.",
    url: "/",
    images: [
      {
        url: "/images/foothold-mark.png",
        width: 1080,
        height: 1080,
        alt: "FootHold AEO",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
  // No facebook-domain-verification tag on purpose. The previous token belonged
  // to the Business Manager that holds the domain claim, and serving it was the
  // only thing keeping that claim valid — Meta re-checks periodically and has
  // nothing to find now. Add the new Business Manager's token here (or, better,
  // as a DNS TXT record, which survives rebuilds and can't be displaced by a
  // deploy) once the domain has been released.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} ${archivo.variable} antialiased`}
      >
        <Header />
        {children}
        <Footer />
        {/* Page views for soft navigations. The tag snippets below fire once on
            document load and never again, and every in-site link is a next/link.
            See the component for what that was costing. */}
        <RouteAnalytics />
        {/* Google Analytics 4 — footholdsystems.com property only */}
        {GA_MEASUREMENT_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}');
              `}
            </Script>
          </>
        )}
        {/* Microsoft Clarity — heatmaps and session replay */}
        {CLARITY_PROJECT_ID && (
          <Script id="ms-clarity" strategy="afterInteractive">
            {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_PROJECT_ID}");`}
          </Script>
        )}
        {/* Whop pixel. Attributes a purchase back to the visit that produced
            it, which none of the tags above can do: GA and Meta stop at our own
            conversion events, and checkout happens on whop.com.

            The body is Whop's snippet verbatim, including the business id.
            Not moved to an env var on purpose — it is a public identifier that
            ships in the page source either way, and a second place to set it is
            a second place for it to be wrong. Same treatment as the Meta pixel
            id above.

            afterInteractive, matching the others: the snippet injects its own
            async script tag, so hoisting it earlier would buy nothing and cost
            first paint. */}
        <Script id="whop-pixel" strategy="afterInteractive">
          {`!function(w,d,s,u,n,a,b){if(w[n])return;a=w[n]={q:[],t:+new Date,s:[],o:u,track:function(){a.q.push([+new Date].concat([].slice.call(arguments)))},setScope:function(){a.s=[].slice.call(arguments).filter(function(x){return typeof x==="string"});a.q.push([+new Date,"setScope"].concat(a.s))},scope:function(){var c=[].slice.call(arguments);return{track:function(){a.q.push([+new Date].concat([].slice.call(arguments)).concat([{__scope:c}]))}}}};b=d.createElement(s);b.async=1;b.src=u+"/s.js";d.getElementsByTagName(s)[0].parentNode.insertBefore(b,d.getElementsByTagName(s)[0])}(window,document,"script","https://t.whop.tw","whop");whop.setScope("biz_hDWlSwXChzsMuv");whop.track("page");`}
        </Script>

        {/* Meta (Facebook) Pixel base code */}
        {META_PIXEL_ID && (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
            </Script>
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
      </body>
    </html>
  );
}
