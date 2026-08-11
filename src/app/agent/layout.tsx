import type { Metadata, Viewport } from "next";
import { AgentAuthProvider } from "@/hooks/agent/use-agent-auth";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { BrandingBootstrap } from "@/components/agent/branding-bootstrap";

// Static metadata is the fallback. The runtime branding hook overrides
// document.title and <link rel="icon"> with the admin-configured values
// as soon as the app boots.
export const metadata: Metadata = {
  title: "Agent",
  description: "Field workforce companion app",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon", sizes: "any" },
      { url: "/agent-icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/agent-icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/agent-icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Agent",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a5c47",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <BrandingBootstrap />
      <AgentAuthProvider>{children}</AgentAuthProvider>
      <Toaster position="top-center" />
    </QueryProvider>
  );
}
