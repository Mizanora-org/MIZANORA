// Re-mounts on every page change, so each page fades in smoothly.
export default function Template({ children }) {
  return <div className="mz-page">{children}</div>;
}
