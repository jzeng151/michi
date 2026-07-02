import type { Metadata, Viewport } from "next";
import { Zen_Kaku_Gothic_New, Shippori_Mincho } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import "./globals.css";

// preload: false is deliberate — CJK faces ship hundreds of unicode-range
// slices, and preloading them all costs ~10MB; on-demand loading fetches
// only the slices the page actually renders.
const zenKaku = Zen_Kaku_Gothic_New({
  variable: "--font-zen-kaku",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  preload: false,
});

const shippori = Shippori_Mincho({
  variable: "--font-shippori",
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Michi — walk Japan, keep the memory",
    template: "%s · Michi",
  },
  description:
    "Curated walking trails and scenic routes across Japan. Record your own walks with photos and audio notes, then replay them as living memories.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/**
 * Runs before first paint to prevent a theme flash. Static string, no user
 * input. Season/mode defaults must stay in sync with ThemeProvider.
 */
const noFlashScript = `(function(){try{
var seasons=["spring","summer","autumn","winter"];
var mo=new Date().getMonth();
var def=mo>=2&&mo<=4?"spring":mo>=5&&mo<=7?"summer":mo>=8&&mo<=10?"autumn":"winter";
var s=localStorage.getItem("michi-season");if(seasons.indexOf(s)<0)s=def;
var m=localStorage.getItem("michi-mode");if(["light","dark","system"].indexOf(m)<0)m="system";
var d=m==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):m;
var e=document.documentElement;e.dataset.season=s;e.dataset.mode=d;e.style.colorScheme=d;
}catch(err){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-season="spring"
      data-mode="light"
      suppressHydrationWarning
      className={`${zenKaku.variable} ${shippori.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-canvas font-sans text-ink">
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
