// Configuration is owned by the trusted demo host; never inherit live SMTP/Twilio credentials.
export const config={databaseFile:process.env.DB_FILE!,facilityTz:process.env.MEDSLOT_FACILITY_TZ??"UTC"};
