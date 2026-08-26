export const siteConfig = {
  name: "SwasthyaSetu",
  shortName: "SwasthyaSetu",
  description:
    "A national public healthcare access platform helping households identify healthcare coverage gaps, verify scheme eligibility, and turn entitlements into care.",
  url: "https://swasthyasetu.gov.in",
  links: {
    portal: "/",
    schemes: "/schemes",
    about: "/about",
    help: "/help",
  },
  navItems: [
    { label: "Overview", href: "/" },
    { label: "Healthcare Schemes", href: "#schemes" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "About Platform", href: "#about" },
  ],
};

export type SiteConfig = typeof siteConfig;
