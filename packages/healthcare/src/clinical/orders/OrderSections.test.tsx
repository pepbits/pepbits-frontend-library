import React, {
  useCallback,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderClinical } from "../test/host";
import { encounterDetail, fakePort } from "../test/fixtures";
import { ClinicalProvider } from "../context/clinical-context";
import { ConsultHostProvider, type ConsultHost } from "../context/consult-host";
import type {
  ConsultationDataPort,
  ConsultDomainPort,
} from "../context/consult-contracts";
import type { ClinicalDataPort } from "../context/port";
import type { ConsultationDetail } from "../types";
import { emptyNote, type NoteContent } from "../models/consult-note";
import type { ConsultSectionProps } from "../models/consult-workflow";
import type {
  InfoResult,
  MedicationCheckInput,
  LabQuestionCatalogue,
  MedicationCheckResult,
  MedicationOrder,
  OrderPriority,
} from "../models/consult-orders";
import {
  OrdersSection,
  MedicinesSection,
  ReferralSection,
  PlanSection,
  EducationSection,
  CertificatesSection,
  DispositionSection,
  type MedicationSafetyState,
} from "../consult-orders";
import { OrderInfoPanel, OrderInfoProvider, useOrderInfo } from "./OrderInfo";
import { LabOrderQuestions } from "./LabOrderQuestions";
import { ProcedureDone } from "./ProcedureDone";
import { SubstitutionDecision } from "./SubstitutionDecision";
import { PriorityPicker } from "./OrderPriority";
import { ToothPicker } from "./ToothPicker";
import { IssuedCertificates } from "./IssuedCertificates";
const priority: OrderPriority = {
  code: "routine",
  label: "Routine",
  rank: 3,
  verifyMinutes: null,
  dispenseMinutes: null,
  firstDoseMinutes: null,
  resultMinutes: null,
  firstDoseBeforeVerification: false,
  reasonRequired: false,
  active: true,
  default: true,
};
function detail(): ConsultationDetail {
  const basic = encounterDetail();
  return {
    ...basic,
    patient: {
      ...basic.patient,
      age: 40,
      sex: "male",
      givenName: "Test",
      familyName: "Patient",
      birthDate: "1986-01-01",
      nationality: "test",
      preferredLanguage: "en",
      identifiers: [],
      version: 1,
    },
    observations: { latest: {}, history: [] },
    medications: [],
    problems: [],
    orders: [],
    note: null,
    reviews: [],
    scores: [],
  };
}
function port(
  overrides: Partial<ConsultationDataPort> = {},
  domain: Partial<ConsultDomainPort> = {}
): ClinicalDataPort {
  const search = vi.fn(async () => []);
  return fakePort({
    searchCatalog: search,
    consult: {
      searchCatalog: search,
      listOrderPriorities: vi.fn(async () => [priority]),
      evaluateOrderForms: vi.fn(async () => ({ results: [], problems: [] })),
      checkMedications: vi.fn(
        async (_patient: string, input: MedicationCheckInput) => ({
          lines: input.lines.map((line) => ({
            code: line.code,
            allergy: [],
            alerts: [],
            needsReason: false,
          })),
          unmapped: [],
          context: {},
        })
      ),
      listReferralPharmacies: vi.fn(async () => []),
      listSpecialties: vi.fn(async () => ["Medicine"]),
      listClinicians: vi.fn(async () => [
        { id: "D1", name: "Test Doctor", role: "doctor" },
      ]),
      loadServices: vi.fn(async () => ({
        specialties: ["Medicine"],
        departments: [
          {
            code: "WARD",
            name: "Test Ward",
            services: ["inpatient"],
            specialties: ["Medicine"],
          },
        ],
        clinics: [],
        wards: [],
      })),
      listFacilities: vi.fn(async () => [
        {
          code: "F1",
          name: "Test Hospital",
          type: "hospital",
          emergency: true,
        },
      ]),
      listEducationTemplates: vi.fn(async () => [
        {
          id: "ED1",
          title: "Test education",
          languages: ["en", "ar"],
          version: 2,
        },
      ]),
      listCertificates: vi.fn(async () => ({
        portalConfigured: false,
        certificates: [],
      })),
      ...overrides,
    } as ConsultationDataPort,
    domain: {
      loadLabQuestions: vi.fn(async () => ({ catalogueVersion: 1, tests: [] })),
      ...domain,
    } as ConsultDomainPort,
  });
}
const host: ConsultHost = {
  onNavigate: vi.fn(),
  renderLink: (destination, props) => (
    <button
      onClick={() => host.onNavigate(destination, { newTab: props.newTab })}
    >
      {props.children}
    </button>
  ),
};
function render(ui: ReactNode, data = port(), customHost = host) {
  return renderClinical(
    <ConsultHostProvider value={customHost}>{ui}</ConsultHostProvider>,
    {
      port: data,
      actor: { role: "doctor", permissions: ["rx.write", "note.write"] },
    }
  );
}
function Draft({
  Section,
  initial = emptyNote(),
  d = detail(),
  readOnly = false,
  changed = () => {},
}: {
  Section: ComponentType<ConsultSectionProps>;
  initial?: NoteContent;
  d?: ConsultationDetail;
  readOnly?: boolean;
  changed?: (n: NoteContent) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const onChange = useCallback<ConsultSectionProps["onChange"]>(
    (fn) =>
      setDraft((old) => {
        const next = structuredClone(old);
        fn(next);
        changed(next);
        return next;
      }),
    [changed]
  );
  return (
    <Section detail={d} draft={draft} onChange={onChange} readOnly={readOnly} />
  );
}
function rxDraft() {
  const n = emptyNote();
  n.prescriptions = [
    {
      code: "RX1",
      display: "Test medicine",
      dose: "5 mg",
      route: "oral",
      frequency: "daily",
      days: 7,
      instructions: "",
      flags: {},
    },
  ];
  return n;
}
function order(): MedicationOrder {
  return {
    id: "O1",
    kind: "medication",
    code: "RX1",
    display: "Test medicine",
    status: "active",
    authorId: "D1",
    authoredAt: "2026-10-28T09:00:00Z",
    version: 4,
    details: {},
  };
}

describe("WP4 controlled sections with synthetic ports", () => {
  it("keeps laboratory answers and indication controlled without mutating the incoming draft", async () => {
    const n = emptyNote();
    n.labs = [{ code: "L1", display: "Test lab", indication: "" }];
    const changed = vi.fn();
    const data = port(
      {},
      {
        loadLabQuestions: vi.fn(
          async (): Promise<LabQuestionCatalogue> => ({
            catalogueVersion: 1,
            tests: [
              {
                code: "L1",
                display: "Test lab",
                profile: {},
                questions: [
                  {
                    code: "fast",
                    label: "Fasting",
                    type: "boolean",
                    stage: "order",
                    required: true,
                  },
                  {
                    code: "col",
                    label: "Collection only",
                    type: "text",
                    stage: "collection",
                    required: true,
                  },
                ],
              },
            ],
          })
        ),
      }
    );
    render(
      <Draft Section={OrdersSection} initial={n} changed={changed} />,
      data
    );
    fireEvent.change(
      await screen.findByRole("combobox", { name: /Fasting \*/ }),
      { target: { value: "false" } }
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Clinical indication" }),
      { target: { value: "Review anaemia" } }
    );
    expect(changed.mock.lastCall?.[0].labs[0]).toMatchObject({
      questions: { fast: { value: false } },
      indication: "Review anaemia",
    });
    expect(n.labs[0]?.questions).toBeUndefined();
    expect(screen.queryByLabelText("Collection only")).not.toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("combobox", { name: "Fasting: reason it is missing" }),
      { target: { value: "declined" } }
    );
    expect(changed.mock.lastCall?.[0].labs[0].questions).toEqual({
      fast: { absent: "declined" },
    });
  });
  it.each(["allergy", "dose", "interaction"] as const)(
    "requires a documented %s safety reason before the host can sign and rechecks dose edits",
    async (kind) => {
      const sign = vi.fn();
      const check = vi.fn(
        async (): Promise<MedicationCheckResult> => ({
          lines: [
            {
              code: "RX1",
              allergy:
                kind === "allergy"
                  ? [
                      {
                        allergyId: "A1",
                        substance: "Test ingredient",
                        verification: "confirmed",
                        match: "same-ingredient",
                        via: "ingredient",
                        severity: "high",
                        message: "High allergy alert",
                      },
                    ]
                  : [],
              alerts:
                kind === "allergy"
                  ? []
                  : [{ kind, severity: "high", message: `High ${kind} alert` }],
              needsReason: true,
            },
          ],
          unmapped: [{ allergyId: "A1", substance: "Test free text allergy" }],
          context: { weightKg: 70 },
        })
      );
      function Workspace() {
        const [draft, setDraft] = useState(rxDraft()),
          [state, setState] = useState<MedicationSafetyState>({
            pending: true,
            ready: false,
            problems: [],
          });
        const change = useCallback<ConsultSectionProps["onChange"]>(
          (fn) =>
            setDraft((old) => {
              const next = structuredClone(old);
              fn(next);
              return next;
            }),
          []
        );
        return (
          <>
            <MedicinesSection
              detail={detail()}
              draft={draft}
              onChange={change}
              readOnly={false}
              onSafetyChange={setState}
            />
            <button disabled={!state.ready} onClick={sign}>
              Sign
            </button>
          </>
        );
      }
      render(<Workspace />, port({ checkMedications: check }));
      expect(screen.getByRole("button", { name: "Sign" })).toBeDisabled();
      await screen.findByText(`High ${kind} alert`);
      expect(screen.getByRole("button", { name: "Sign" })).toBeDisabled();
      fireEvent.change(
        screen.getByRole("textbox", {
          name: /Reason to proceed with Test medicine/,
        }),
        { target: { value: "   " } }
      );
      expect(screen.getByRole("button", { name: "Sign" })).toBeDisabled();
      fireEvent.change(
        screen.getByRole("textbox", {
          name: /Reason to proceed with Test medicine/,
        }),
        {
          target: {
            value: "Benefit reviewed; dose appropriate for this patient",
          },
        }
      );
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Sign" })).toBeEnabled()
      );
      fireEvent.click(screen.getByRole("button", { name: "Sign" }));
      expect(sign).toHaveBeenCalledOnce();
      fireEvent.change(screen.getByRole("textbox", { name: "Dose" }), {
        target: { value: "10 mg" },
      });
      expect(screen.getByRole("button", { name: "Sign" })).toBeDisabled();
      await waitFor(() => expect(check).toHaveBeenCalledTimes(2));
      expect(check.mock.calls[1]).toMatchObject([
        "P1",
        {
          lines: [{ code: "RX1", dose: "10 mg", frequency: "daily" }],
          stopping: [],
        },
        expect.any(AbortSignal),
      ]);
    }
  );
  it("fails sign readiness when safety checks fail, preserving the prescription", async () => {
    const safety = vi.fn();
    const check = vi
      .fn()
      .mockRejectedValue({ problems: ["Medication safety unavailable"] });
    render(
      <MedicinesSection
        detail={detail()}
        draft={rxDraft()}
        onChange={vi.fn()}
        readOnly={false}
        onSafetyChange={safety}
      />,
      port({ checkMedications: check })
    );
    await screen.findAllByText("Medication safety unavailable");
    // The safety state is reported from an effect after the error renders.
    await waitFor(() =>
      expect(safety.mock.lastCall?.[0]).toMatchObject({
        pending: false,
        ready: false,
      })
    );
    expect(screen.getByRole("textbox", { name: "Dose" })).toHaveValue("5 mg");
  });
  it("renews a past medicine through formulary search and retains its version", async () => {
    const d = detail();
    d.medications = [
      {
        id: "M1",
        display: "Past test medicine",
        drugCode: "RX1",
        status: "stopped",
        source: "reported",
        version: 8,
      },
    ];
    const search = vi.fn(async () => [
      {
        system: "test",
        code: "RX1",
        display: "Test medicine",
        meta: {
          defaultDose: "5 mg",
          routes: ["oral"],
          defaultFrequency: "daily",
        },
      },
    ]);
    const changed = vi.fn();
    render(
      <Draft Section={MedicinesSection} d={d} changed={changed} />,
      port({ searchCatalog: search })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Represcribe Past test medicine" })
    );
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(search).toHaveBeenCalledWith(
      "drugs",
      "Past test medicine",
      expect.any(AbortSignal),
      { limit: 20 }
    );
    expect(changed.mock.lastCall?.[0]).toMatchObject({
      prescriptions: [{ renews: "M1" }],
      history: { meds: { M1: "continue" }, medVersions: { M1: 8 } },
    });
  });
  it("saves external referral details atomically and clears conflicting disposition data", async () => {
    const n = emptyNote();
    n.disposition = "admit";
    n.admission = { timing: "now" };
    n.followUp = { value: 1, unit: "week" };
    const changed = vi.fn();
    render(<Draft Section={ReferralSection} initial={n} changed={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "Add referral" }));
    await screen.findByRole("option", { name: "Medicine" });
    fireEvent.change(screen.getByRole("combobox", { name: /Specialty/ }), {
      target: { value: "Medicine" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Where" }), {
      target: { value: "external" },
    });
    await screen.findByRole("option", { name: "Test Hospital" });
    fireEvent.change(screen.getByRole("combobox", { name: /Organisation/ }), {
      target: { value: "Test Hospital" },
    });
    expect(
      screen.getByRole("button", { name: "Save referral" })
    ).toBeDisabled();
    fireEvent.change(
      screen.getByRole("textbox", { name: /Clinical question/ }),
      { target: { value: "Please assess symptoms" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Save referral" }));
    expect(changed.mock.lastCall?.[0]).toMatchObject({
      disposition: "refer-external",
      admission: null,
      emergency: null,
      followUp: null,
      referral: {
        specialty: "Medicine",
        organisation: "Test Hospital",
        question: "Please assess symptoms",
      },
    });
  });
  it("adds versioned education in the patient's language and records understanding", async () => {
    const d = detail();
    d.patient.preferredLanguage = "ar";
    const changed = vi.fn();
    render(<Draft Section={EducationSection} d={d} changed={changed} />);
    await screen.findByRole("option", { name: "Test education" });
    fireEvent.change(
      screen.getByRole("combobox", { name: "Add education material" }),
      { target: { value: "ED1" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", {
        name: "Understanding of Test education (v2)",
      }),
      { target: { value: "understood" } }
    );
    expect(changed.mock.lastCall?.[0].education).toEqual([
      {
        templateId: "ED1",
        title: "Test education (v2)",
        language: "ar",
        method: ["verbal"],
        understanding: "understood",
      },
    ]);
  });
  it("enables follow-up only for its disposition and clears it when returning home", () => {
    const changed = vi.fn();
    render(<Draft Section={PlanSection} changed={changed} />);
    expect(
      screen.getByRole("spinbutton", { name: "Follow-up in" })
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Home with follow-up" })
    );
    fireEvent.click(screen.getByRole("button", { name: "2 weeks" }));
    expect(changed.mock.lastCall?.[0].followUp).toEqual({
      value: 2,
      unit: "week",
    });
    fireEvent.click(screen.getByRole("button", { name: "Home" }));
    expect(changed.mock.lastCall?.[0]).toMatchObject({
      disposition: "home",
      followUp: null,
      followUpNone: false,
    });
  });
  it("requires complete admission details and leaves the draft untouched on cancel", async () => {
    const changed = vi.fn();
    render(<Draft Section={DispositionSection} changed={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "Admit…" }));
    await screen.findByRole("option", { name: "Test Ward" });
    expect(
      screen.getByRole("button", { name: "Save admission request" })
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Admit…" }));
    await screen.findByRole("option", { name: "Test Ward" });
    for (const [name, value] of [
      ["Specialty", "Medicine"],
      ["Urgency", "immediate"],
      ["Admitting department", "Test Ward"],
    ])
      fireEvent.change(
        screen.getByRole("combobox", { name: new RegExp(name!) }),
        { target: { value } }
      );
    fireEvent.change(
      screen.getByRole("spinbutton", { name: /Expected stay/ }),
      { target: { value: "2" } }
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: /Reason for admission/ }),
      { target: { value: "Observation and treatment" } }
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save admission request" })
    );
    expect(changed.mock.lastCall?.[0]).toMatchObject({
      disposition: "admit",
      admission: {
        urgency: "immediate",
        department: "Test Ward",
        expectedStayDays: 2,
        reason: "Observation and treatment",
      },
    });
  });
  it("requires emergency destination and transport before saving", async () => {
    const changed = vi.fn();
    render(<Draft Section={DispositionSection} changed={changed} />);
    fireEvent.click(screen.getByRole("button", { name: "Send to emergency…" }));
    expect(
      screen.getByRole("button", { name: "Save emergency transfer" })
    ).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: /Transport/ }), {
      target: { value: "ambulance" },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save emergency transfer" })
      ).toBeEnabled()
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Save emergency transfer" })
    );
    expect(changed.mock.lastCall?.[0]).toMatchObject({
      disposition: "refer-er",
      emergency: {
        destination: "internal",
        department: "Emergency department",
        transport: "ambulance",
      },
    });
  });
  it("captures certificate dates and fitness and shows invalid ranges", () => {
    const changed = vi.fn();
    render(<Draft Section={CertificatesSection} changed={changed} />);
    fireEvent.change(
      screen.getByRole("combobox", { name: "Certificate needed" }),
      { target: { value: "yes" } }
    );
    fireEvent.change(screen.getByLabelText("From"), {
      target: { value: "2026-10-28" },
    });
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-10-27" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "end date must not be before"
    );
    fireEvent.change(screen.getByLabelText("To"), {
      target: { value: "2026-10-30" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Fitness" }), {
      target: { value: "unfit" },
    });
    expect(changed.mock.lastCall?.[0].certificate).toEqual({
      needed: true,
      from: "2026-10-28",
      to: "2026-10-30",
      fitness: "unfit",
    });
  });
  it.each([
    OrdersSection,
    MedicinesSection,
    ReferralSection,
    EducationSection,
    PlanSection,
    DispositionSection,
    CertificatesSection,
  ])(
    "guards controlled section edits in read-only mode (%#)",
    async (Section) => {
      const n = rxDraft();
      n.labs = [{ code: "L1", display: "Test lab", indication: "Original" }];
      n.certificate.needed = true;
      const changed = vi.fn();
      const view = render(
        <Draft Section={Section} initial={n} readOnly changed={changed} />
      );
      await act(async () => {});
      for (const control of view.container.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input,select,textarea")) {
        expect(control).toBeDisabled();
        fireEvent.change(control, { target: { value: "changed" } });
      }
      expect(changed).not.toHaveBeenCalled();
    }
  );
});

describe("WP4 supporting order workflows", () => {
  it("renders evaluated CEL fields, including false, shared answers, missing values and warning reasons", async () => {
    const evaluated: InfoResult = {
      list: "labs",
      index: 0,
      code: "L1",
      display: "Test lab",
      sections: [
        {
          code: "safety",
          title: "Safety",
          safety: true,
          fields: [
            {
              key: "pregnant",
              label: "Pregnant",
              dataType: "boolean",
              absence: ["unknown"],
              visible: true,
              required: true,
              calculated: false,
              status: "valid",
              value: false,
              problems: [],
              checks: [],
            },
            {
              key: "weight",
              label: "Weight",
              dataType: "decimal",
              absence: [],
              visible: true,
              required: true,
              calculated: false,
              status: "missing",
              suggested: 70,
              problems: [],
              checks: [],
            },
            {
              key: "hidden",
              label: "Hidden field",
              dataType: "text",
              absence: [],
              visible: false,
              required: false,
              calculated: false,
              status: "valid",
              problems: [],
              checks: [],
            },
          ],
        },
      ],
      missing: [{ key: "weight", label: "Weight required" }],
      invalid: [],
      blocks: [],
      warnings: [
        {
          id: "WARN1",
          key: "pregnant",
          label: "Review",
          level: "warn",
          message: "Review before ordering",
        },
      ],
      informs: [],
      complete: false,
    };
    const evaluate = vi.fn(async () => ({
      results: [evaluated],
      problems: [],
    }));
    const changed = vi.fn();
    function Section(props: ConsultSectionProps) {
      const info = useOrderInfo(
        props.draft,
        props.detail.encounter.id,
        props.readOnly
      );
      return (
        <OrderInfoProvider value={info}>
          <OrderInfoPanel
            list="labs"
            index={0}
            onChange={props.onChange}
            readOnly={props.readOnly}
          />
        </OrderInfoProvider>
      );
    }
    const n = emptyNote();
    n.labs = [
      {
        code: "L1",
        display: "Test lab",
        priority: "routine",
        indication: "Review",
      },
    ];
    render(
      <Draft Section={Section} initial={n} changed={changed} />,
      port({ evaluateOrderForms: evaluate })
    );
    expect(
      await screen.findByRole("combobox", { name: /Pregnant \*/ })
    ).toHaveValue("false");
    expect(screen.queryByLabelText("Hidden field")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Use recorded: 70" }));
    expect(changed.mock.lastCall?.[0].orderInfo.answers).toEqual({
      weight: 70,
    });
    await waitFor(() => expect(evaluate).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        screen.getByRole("textbox", {
          name: "Reason to continue: Review before ordering",
        })
      ).toBeInTheDocument()
    );
    fireEvent.change(
      screen.getByRole("textbox", {
        name: "Reason to continue: Review before ordering",
      }),
      { target: { value: "Reviewed risks with patient" } }
    );
    expect(changed.mock.lastCall?.[0].orderInfo.reasons).toEqual({
      WARN1: "Reviewed risks with patient",
    });
    await waitFor(() => expect(evaluate).toHaveBeenCalledTimes(3));
    expect(evaluate.mock.lastCall).toMatchObject([
      "E1",
      {
        labs: [{ code: "L1", priority: "routine" }],
        orderInfo: {
          answers: { weight: 70 },
          reasons: { WARN1: "Reviewed risks with patient" },
        },
      },
      expect.any(AbortSignal),
    ]);
  });
  it("aborts safety checks on host replacement and ignores an old host response", async () => {
    let resolveOld!: (result: MedicationCheckResult) => void;
    const oldCheck = vi.fn(
      (_id: string, _input: MedicationCheckInput, _signal?: AbortSignal) =>
        new Promise<MedicationCheckResult>((resolve) => {
          resolveOld = resolve;
        })
    );
    const old = port({ checkMedications: oldCheck }),
      next = port();
    const onSafetyChange = vi.fn();
    function Switch() {
      const [current, setCurrent] = useState(old);
      return (
        <>
          <button onClick={() => setCurrent(next)}>Switch host</button>
          <ClinicalProvider
            port={current}
            actor={{ role: "doctor", permissions: ["rx.write"] }}
          >
            <MedicinesSection
              draft={rxDraft()}
              detail={detail()}
              onChange={() => {}}
              readOnly={false}
              onSafetyChange={onSafetyChange}
            />
          </ClinicalProvider>
        </>
      );
    }
    render(<Switch />, old);
    await waitFor(() => expect(oldCheck).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: "Switch host" }));
    expect(oldCheck.mock.calls[0]?.[2]?.aborted).toBe(true);
    await waitFor(() =>
      expect(onSafetyChange.mock.lastCall?.[0].ready).toBe(true)
    );
    await act(async () =>
      resolveOld({
        lines: [
          {
            code: "RX1",
            allergy: [],
            alerts: [
              { kind: "dose", severity: "high", message: "Obsolete alert" },
            ],
            needsReason: true,
          },
        ],
        unmapped: [],
        context: {},
      })
    );
    expect(screen.queryByText("Obsolete alert")).not.toBeInTheDocument();
    expect(onSafetyChange.mock.lastCall?.[0].ready).toBe(true);
  });
  it("renders required host workflows through slots and explicit unavailability", async () => {
    const data = port(),
      d = detail();
    d.orders = [order()];
    const history = vi.fn(() => <p>Host medication history</p>),
      administration = vi.fn(
        (
          _props: Parameters<
            NonNullable<ConsultHost["renderAdministration"]>
          >[0]
        ) => <p>Host administration</p>
      );
    render(
      <MedicinesSection
        detail={d}
        draft={emptyNote()}
        onChange={() => {}}
        readOnly={false}
      />,
      data,
      {
        ...host,
        renderMedicationHistory: history,
        renderAdministration: administration,
      }
    );
    fireEvent.click(screen.getByRole("button", { name: "Medication history" }));
    expect(screen.getByText("Host medication history")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Administration, returns and vaccinations",
      })
    );
    expect(screen.getByText("Host administration")).toBeInTheDocument();
    expect(administration.mock.lastCall?.[0]).toMatchObject({
      detail: d,
      readOnly: false,
      onRecordsChanged: expect.any(Function),
      onBusyChange: expect.any(Function),
    });
    fireEvent.click(screen.getByRole("button", { name: "Substitution" }));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Pharmacy substitution workflow is unavailable."
    );
    await act(async () => {});
  });
  it("preserves substitution request identity and payload across uncertain-failure retries", async () => {
    const o = order();
    o.substitution = {
      id: "S1",
      status: "pending-prescriber",
      type: "generic",
      from: { code: "RX1", display: "Original" },
      to: { code: "RX2", display: "Alternative", dose: "5 mg", route: "oral" },
      reasonCode: "stock",
      reasonLabel: "Stock",
      note: "Same ingredient",
      policyVersion: 1,
      allergyConflicts: [],
      alerts: [],
      needsOverride: false,
      approvalReasons: [],
      proposedBy: "PH1",
      proposedByName: "Test Pharmacist",
      proposedAt: "2026-10-28T08:00:00Z",
    };
    const decide = vi
        .fn()
        .mockRejectedValueOnce(new Error("Connection lost"))
        .mockResolvedValue(undefined),
      changed = vi.fn();
    render(
      <SubstitutionDecision
        encounterId="E1"
        order={o}
        disabled={false}
        onRecordsChanged={changed}
      />,
      port({}, { decideSubstitution: decide })
    );
    expect(
      screen.getByRole("button", { name: "Approve substitution" })
    ).toBeDisabled();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Prescriber decision note" }),
      { target: { value: "Reviewed and approved alternative" } }
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Approve substitution" })
    );
    await screen.findByRole("button", {
      name: "Retry previous substitution action",
    });
    expect(screen.getByRole("textbox")).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Retry previous substitution action" })
    );
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(decide.mock.calls[0]).toEqual(decide.mock.calls[1]);
    expect(decide.mock.calls[0]).toEqual([
      "E1",
      "O1",
      {
        version: 4,
        decision: "approve",
        note: "Reviewed and approved alternative",
        requestId: expect.any(String),
      },
    ]);
  });
  it("requires procedure consent, keeps outcome on error and reloads after success", async () => {
    const complete = vi
        .fn()
        .mockRejectedValueOnce({ problems: ["Procedure is locked"] })
        .mockResolvedValue(undefined),
      changed = vi.fn();
    render(
      <ProcedureDone
        encounterId="E1"
        order={{
          id: "PR1",
          display: "Test procedure",
          status: "active",
          details: { consentRequired: true },
        }}
        canWrite
        onDone={changed}
      />,
      port({ completeProcedure: complete })
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));
    expect(
      screen.getByRole("button", { name: "Record as done" })
    ).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Outcome" }), {
      target: { value: "Completed successfully" },
    });
    fireEvent.change(
      screen.getByRole("combobox", {
        name: "The patient's consent was obtained",
      }),
      { target: { value: "yes" } }
    );
    fireEvent.click(screen.getByRole("button", { name: "Record as done" }));
    await screen.findByText("Procedure is locked");
    expect(screen.getByRole("textbox", { name: "Outcome" })).toHaveValue(
      "Completed successfully"
    );
    fireEvent.click(screen.getByRole("button", { name: "Record as done" }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(complete).toHaveBeenLastCalledWith("E1", "PR1", {
      outcome: "Completed successfully",
      consentConfirmed: true,
    });
  });
  it("prints certificates through host navigation and retries portal submission", async () => {
    const list = vi.fn(async () => ({
        portalConfigured: true,
        certificates: [
          {
            id: "C1",
            number: "TEST-1",
            days: 2,
            from: "2026-10-28",
            to: "2026-10-29",
            portal: { status: "failed", error: "Portal unreachable" },
          },
        ],
      })),
      resend = vi.fn(async () => {}),
      changed = vi.fn();
    render(
      <IssuedCertificates
        encounterId="E1"
        signed
        canSend
        onRecordsChanged={changed}
      />,
      port({ listCertificates: list, resendCertificate: resend })
    );
    fireEvent.click(await screen.findByRole("button", { name: "Print" }));
    expect(host.onNavigate).toHaveBeenLastCalledWith(
      { kind: "certificate", certificateId: "C1" },
      { newTab: true }
    );
    fireEvent.click(screen.getByRole("button", { name: "Send again" }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(resend).toHaveBeenCalledWith("C1");
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });
  it("disables inactive and emergency priorities and requires policy reasons", () => {
    const changed = vi.fn();
    render(
      <PriorityPicker
        value={{ priority: "retired" }}
        priorities={[
          priority,
          { ...priority, code: "retired", label: "Retired", active: false },
          {
            ...priority,
            code: "emergency",
            label: "Emergency",
            firstDoseBeforeVerification: true,
            reasonRequired: true,
          },
        ]}
        onChange={changed}
        emergencyAllowed={false}
      />
    );
    expect(
      screen.getByRole("option", { name: "Retired (inactive)" })
    ).toBeDisabled();
    expect(screen.getByRole("option", { name: "Emergency" })).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox", { name: "Order priority" }), {
      target: { value: "emergency" },
    });
    expect(changed).not.toHaveBeenCalled();
  });
  it("selects FDI teeth and surfaces without replacing the other site values", () => {
    const changed = vi.fn();
    function Teeth() {
      const [site, setSite] = useState({ teeth: ["51"], surfaces: ["M"] });
      return (
        <ToothPicker
          child
          {...site}
          onChange={(next) => {
            setSite(next);
            changed(next);
          }}
        />
      );
    }
    render(<Teeth />);
    fireEvent.click(screen.getByRole("button", { name: "Tooth 52" }));
    expect(changed).toHaveBeenLastCalledWith({
      teeth: ["51", "52"],
      surfaces: ["M"],
    });
    fireEvent.click(screen.getByRole("button", { name: "Buccal" }));
    expect(changed).toHaveBeenLastCalledWith({
      teeth: ["51", "52"],
      surfaces: ["M", "B"],
    });
  });
  it("offers retry for a failed laboratory question read", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce({ problems: ["Question service unavailable"] })
      .mockResolvedValue({
        catalogueVersion: 1,
        tests: [
          {
            code: "L1",
            display: "Test lab",
            profile: {},
            questions: [
              {
                code: "Q1",
                label: "Clinical details",
                type: "text",
                stage: "order",
                required: false,
              },
            ],
          },
        ],
      });
    render(
      <LabOrderQuestions code="L1" onChange={() => {}} />,
      port({}, { loadLabQuestions: load })
    );
    fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
    expect(
      await screen.findByRole("textbox", { name: "Clinical details" })
    ).toBeInTheDocument();
  });
});

describe("Signed-order capabilities", () => {
  it("allows explicitly authorized completion while the note remains locked", async () => {
    const complete = vi.fn(async () => {}),
      changed = vi.fn();
    const d = detail();
    d.note = {
      id: "N1",
      status: "final",
      version: 2,
      updatedAt: "2026-10-28T08:00:00Z",
      content: emptyNote(),
    };
    render(
      <OrdersSection
        detail={d}
        draft={emptyNote()}
        readOnly
        onChange={changed}
        canCompleteProcedures
        procedureOrders={[
          {
            id: "PR1",
            status: "active",
            display: "Test procedure",
            details: { consentRequired: false },
          },
        ]}
      />,
      port({ completeProcedure: complete })
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Outcome" }), {
      target: { value: "Completed after signing" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record as done" }));
    await waitFor(() =>
      expect(complete).toHaveBeenCalledWith("E1", "PR1", {
        outcome: "Completed after signing",
        consentConfirmed: false,
      })
    );
    expect(changed).not.toHaveBeenCalled();
  });
  it("corrects signed discharge time with its expected version and a documented reason", async () => {
    const d = detail();
    d.note = {
      id: "N1",
      status: "final",
      version: 2,
      updatedAt: "2026-10-28T08:00:00Z",
      content: emptyNote(),
    };
    d.encounter.clinicalDischargeAt = "2026-10-27T10:00:00Z";
    const correct = vi.fn(async () => ({
        ...d.encounter,
        version: 4,
        clinicalDischargeAt: "2026-10-27T11:00:00Z",
      })),
      changed = vi.fn();
    const n = emptyNote();
    n.disposition = "home";
    render(
      <DispositionSection
        detail={d}
        draft={n}
        readOnly
        onChange={vi.fn()}
        onRecordsChanged={changed}
      />,
      port({ recordClinicalDischarge: correct })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Correct discharge time" })
    );
    expect(
      screen.getByRole("button", { name: "Save correction" })
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Correct time"), {
      target: { value: "2026-10-27T11:00" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /Reason/ }), {
      target: { value: "Corrected the documented release time" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save correction" }));
    await waitFor(() => expect(changed).toHaveBeenCalledOnce());
    expect(correct).toHaveBeenCalledWith("E1", {
      at: new Date("2026-10-27T11:00").toISOString(),
      reason: "Corrected the documented release time",
      expectedVersion: 3,
    });
  });
});
