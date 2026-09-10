import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SwasthyaSetu Household Health Access",
  description: "Tap-access view for verified household healthcare entitlements.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NfcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
