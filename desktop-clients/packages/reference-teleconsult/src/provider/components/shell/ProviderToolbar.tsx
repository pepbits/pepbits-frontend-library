"use client";
import { LocalizedText, useLocalization } from "@pepbits/ops-ui";
import { HeartPulse, Stethoscope, WifiOff } from "lucide-react";
import type { Role } from "../../../shared/types";
import { useSession } from "../../lib/session";
import { Avatar, Segmented } from "../ui";

const MODE: Record<Role, { label: string; icon: typeof Stethoscope }> = {
  doctor: { label: "Doctor", icon: Stethoscope },
  nurse: { label: "Nurse", icon: HeartPulse },
};

/**
 * Compact replacement for the source top bar. The host already supplies the sidebar and page header, so
 * this keeps only what the workstation needs: the Doctor/Nurse mode chooser (limited to the modes the
 * server granted this account), the staff identity and an API-offline hint.
 */
export function ProviderToolbar({ title }: { title: string }) {
  const { t } = useLocalization();
  const { role, roles, setRole, user, apiError } = useSession();
  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-white px-3 sm:px-5" data-teleconsult-toolbar="provider">
      <h1 className="text-[15px] font-semibold text-ink">{t(title)}</h1>
      {apiError && (
        <span className="hidden items-center gap-1.5 rounded-full bg-alarm-50 px-2.5 py-1 text-xs font-medium text-alarm-600 sm:inline-flex" title={apiError} role="status">
          <WifiOff className="h-3.5 w-3.5" />  <LocalizedText message={"API offline"} />
        </span>
      )}
      <span className="rounded bg-caution-50 px-1.5 py-0.5 text-2xs font-medium text-caution-600" data-demo-notice="true"><LocalizedText message={"Demo workspace · fictional data"} /></span>
      <div className="ml-auto flex items-center gap-3">
        <div role="group" aria-label={t("Working mode")}>
          <Segmented
            size="sm"
            value={role}
            onChange={setRole}
            options={roles.map((value) => {
              const { label, icon: Icon } = MODE[value];
              return { value, label: <span className="flex items-center gap-1"><Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{t(label)}</span></span> };
            })}
          />
        </div>
        {user && (
          <div className="flex items-center gap-2">
            <Avatar name={user.name} color={user.color} size={32} />
            <div className="hidden leading-tight lg:block">
              <p className="text-[13px] font-medium text-ink">{user.name}</p>
              <p className="text-2xs text-ink-400">{user.specialty}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
