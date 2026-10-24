import { cx } from "../../lib/cx";
import type { User } from "../../lib/types";

const TONES: Record<string, string> = {
  spruce: "bg-spruce-100 text-spruce-800",
  saffron: "bg-saffron-100 text-saffron-700",
  cobalt: "bg-cobalt-100 text-cobalt-700",
  madder: "bg-madder-100 text-madder-700",
};

export function Avatar({ user, size = "md" }: { user?: User; size?: "sm" | "md" }) {
  if (!user) return <span className={cx("inline-block rounded-full bg-mist", size === "sm" ? "h-5 w-5" : "h-8 w-8")} />;
  const label = `${user.name}, ${user.title}`;
  return (
    <span
      title={label}
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-bold", TONES[user.tone] ?? TONES.spruce, size === "sm" ? "h-5 w-5 text-[9.5px]" : "h-8 w-8 text-[11.5px]")}
    >
      {user.initials}
    </span>
  );
}
