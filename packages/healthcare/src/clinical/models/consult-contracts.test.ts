import {expectTypeOf, it} from "vitest";
import type {ConsultationDetail, ConsultationOrder, ProcedureHistory} from "../types";
import type {ProcedureOrder} from "../orders/ProcedureDone";
import type {ProcedureHistoryPatch} from "./consult-records";

it("exposes procedure completion metadata to hosts without a local order cast", () => {
  expectTypeOf<ConsultationDetail["orders"][number]>().toEqualTypeOf<ConsultationOrder>();
  expectTypeOf<ConsultationOrder>().toExtend<ProcedureOrder>();
  expectTypeOf<ConsultationOrder["completedAt"]>().toEqualTypeOf<string | undefined>();
  expectTypeOf<ConsultationOrder["details"]["consentRequired"]>().toEqualTypeOf<boolean | undefined>();
});

it("accepts entered-in-error records and requires a reason on their correction patches", () => {
  expectTypeOf<"entered-in-error">().toExtend<ProcedureHistory["verification"]>();
  expectTypeOf<{version: number; verification: "entered-in-error"; reason: string}>().toExtend<ProcedureHistoryPatch>();
  expectTypeOf<{version: number; verification: "entered-in-error"}>().not.toExtend<ProcedureHistoryPatch>();
});
