import type {
  Metadata,
} from "next";

import "./globals.css";

import WebsiteRealtimeProvider
  from "@/realtime/WebsiteRealtimeProvider";

export const metadata:
  Metadata = {
  title:
    "Palmyrah Hotel",

  description:
    "Palmyrah Hotel Kalpitiya",
};

export default function RootLayout(
  {
    children,
  }: Readonly<{
    children:
    React.ReactNode;
  }>
) {
  return (
    <html lang="en">
      <body>
        {/*
        |--------------------------------------------------------------------------
        | Website Realtime Provider
        |--------------------------------------------------------------------------
        |
        | This is the Website's single Echo / Reverb connection.
        |
        | It is intentionally mounted at the root so both:
        |
        | - normal Website pages
        | - QR ordering pages
        |
        | can receive public realtime invalidation events.
        |--------------------------------------------------------------------------
        */}

        <WebsiteRealtimeProvider>
          {children}
        </WebsiteRealtimeProvider>
      </body>
    </html>
  );
}