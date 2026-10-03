import { cx } from "../../lib/cx";
import type { User } from "../../lib/types";

const TONES: Record<string, string> = {
  harbor: "bg-harbor-100 text-harbor-800",
  cyan: "bg-signal-100 text-signal-700",
  saffron: "bg-saffron-100 text-saffron-700",
  cobalt: "bg-cobalt-100 text-cobalt-700",
  jade: "bg-jade-100 text-jade-700",
  madder: "bg-madder-100 text-madder-700",
};

export function Avatar({ user, size = "md" }: { user?: User; size?: "xs" | "sm" | "md" }) {
  const dim = size === "xs" ? "h-[18px] w-[18px] text-[8.5px]" : size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-[11.5px]";
  if (!user) return <span className={cx("inline-block rounded-full bg-mist", dim)} />;
  return (
    <span title={user.name + ", " + user.title} className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-bold", TONES[user.tone] ?? TONES.harbor, dim)}>
      {user.initials}
    </span>
  );
}
