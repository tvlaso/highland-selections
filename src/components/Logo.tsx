import logo from "@/assets/highland-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({
  className = "h-10",
  white = false,
}: {
  className?: string;
  white?: boolean;
}) {
  return (
    <img
      src={logo.url}
      alt="Highland Remodeling — Bath, Kitchen, Tile"
      className={cn(className, white && "brightness-0 invert")}
      loading="eager"
    />
  );
}
