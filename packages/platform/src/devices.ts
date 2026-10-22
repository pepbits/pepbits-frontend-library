/** The native host owns pairing, permissions, spooler access and device drivers. */
export interface DeviceTicket {
  jobId: string;
  deviceId: string;
  contentReference: string;
  expiresAt: string;
}
export interface DeviceAcknowledgement {
  jobId: string;
  state: "accepted" | "failed" | "unknown";
  reference?: string;
}
export interface DeviceConnector {
  submit(
    ticket: DeviceTicket,
    signal?: AbortSignal,
  ): Promise<DeviceAcknowledgement>;
  status(jobId: string, signal?: AbortSignal): Promise<DeviceAcknowledgement>;
}
/** Inject only an authenticated, allowlisted host transport; never arbitrary device URLs or raw commands. */
export function createDeviceConnector(
  call: (
    method: "submit" | "status",
    payload: unknown,
    signal?: AbortSignal,
  ) => Promise<DeviceAcknowledgement>,
): DeviceConnector {
  const validate = (id: string, r: DeviceAcknowledgement) => {
    if (r.jobId !== id || !["accepted", "failed", "unknown"].includes(r.state))
      throw new Error("Invalid device acknowledgement");
    return r;
  };
  return {
    async submit(ticket, signal) {
      if (
        !ticket.jobId ||
        !ticket.deviceId ||
        !ticket.contentReference ||
        !Number.isFinite(Date.parse(ticket.expiresAt)) ||
        Date.parse(ticket.expiresAt) <= Date.now()
      )
        throw new Error("Invalid or expired device ticket");
      return validate(ticket.jobId, await call("submit", ticket, signal));
    },
    async status(jobId, signal) {
      return validate(jobId, await call("status", { jobId }, signal));
    },
  };
}
