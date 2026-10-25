# Clinic billing demo catalog

`services.csv` supplies fictional tariffs to Billing Clinic through the demo API. `price` is an integer number of minor currency units (AED cents); `taxBps` and `coverageBps` are integers from 0 to 10000. Labels are canonical localization message keys. Changes take effect after restarting the API. Invalid catalog values stop startup.

Source pharmacy rows use the medication demo tariff; source order rows use the laboratory demo tariff. Real applications must supply exact service-code mappings, contract prices and payer rules. This fixture does not prescribe medication or establish an insurer agreement.

The writable ledger is a separate `clinic-billing.csv` under the configured data directory, scoped by tenant, application and patient. Do not edit it while the single demo writer is running. See [the user and integration guide](../../../docs/features/billing-clinic.md).
