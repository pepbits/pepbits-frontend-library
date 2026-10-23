import { cx } from "../../lib/cx";
import { SourceButton } from "./controls";

export function Switch({ checked, onChange, disabled, id, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; id?: string; label?: string }) {
  return (
    <SourceButton
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "bg-jade-600" : "bg-switch-off",
      )}
    >
      <span className={cx("inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform", checked ? "translate-x-[18px]" : "translate-x-[2px]")} />
    </SourceButton>
  );
}
