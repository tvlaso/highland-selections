import logo from "@/assets/highland-logo.png.asset.json";

export function Logo({ className = "h-10" }: { className?: string }) {
  return (
    <img
      src={logo.url}
      alt="Highland Remodeling — Bath, Kitchen, Tile"
      className={className}
      loading="eager"
    />
  );
}