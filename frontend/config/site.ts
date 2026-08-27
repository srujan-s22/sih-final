export const siteConfig = {
  name: "SwasthyaSetu",
  shortName: "SwasthyaSetu",
  description:
    "A national public healthcare access platform helping households discover healthcare schemes, verify support eligibility, and take actionable next steps.",
  url: "https://swasthyasetu.gov.in",
  links: {
    portal: "/citizen",
    schemes: "#schemes",
    howItWorks: "#how-it-works",
  },
  navItems: [
    { label: "Healthcare Schemes", href: "/#schemes" },
    { label: "How It Works", href: "/#how-it-works" },
  ],
};

export type SiteConfig = typeof siteConfig;
