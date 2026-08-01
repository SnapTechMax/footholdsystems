/**
 * Dark surface for the admin pages.
 *
 * These were styled for a dark background, but the site's is cream, so every
 * heading was cream-on-cream and effectively invisible. The cards carry their
 * own dark fill and looked fine, which is exactly why it went unnoticed.
 *
 * Set here rather than per page so the three dashboards cannot drift apart, and
 * so anything added under /admin later inherits it.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-[#1b1b1b]">{children}</div>;
}
