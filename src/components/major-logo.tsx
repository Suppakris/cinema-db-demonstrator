export function MajorLogo({ height = 30 }: { height?: number }) {
  return (
    <svg className="major-logo" height={height} viewBox="0 0 132 36" role="img" aria-label="Major Cineplex">
      <rect width="132" height="36" rx="4" fill="#e4002b" />
      <text x="66" y="22" textAnchor="middle" fill="#fff" fontFamily="var(--font-geist-sans), Arial, sans-serif" fontSize="19" fontWeight="900" letterSpacing="1.5">MAJOR</text>
      <text x="66" y="31.5" textAnchor="middle" fill="#fff" fillOpacity=".85" fontFamily="var(--font-geist-sans), Arial, sans-serif" fontSize="6.4" fontWeight="700" letterSpacing="3.2">CINEPLEX</text>
    </svg>
  );
}
