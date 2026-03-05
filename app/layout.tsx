import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = localFont({
    src: [
        {
            path: "../public/fonts/inter/InterVariable.woff2",
            style: "normal",
            weight: "100 900",
        },
        {
            path: "../public/fonts/inter/InterVariable-Italic.woff2",
            style: "italic",
            weight: "100 900",
        },
    ],
    display: "swap",
    fallback: [
        "system-ui",
        "-apple-system",
        "BlinkMacSystemFont",
        "Segoe UI",
        "sans-serif",
    ],
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXTAUTH_URL ?? "http://localhost:3000"),
    title: "PTZ Controller",
    description: "Professional PTZ Camera Control System",
    icons: {
        icon: "/favicon.svg",
        shortcut: "/favicon.svg",
    },
    openGraph: {
        title: "PTZ Controller",
        description: "Professional PTZ Camera Control System",
        images: ["/og-image.png"],
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head />
            <body className={inter.className}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
