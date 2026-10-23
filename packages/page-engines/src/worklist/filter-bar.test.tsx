import {render} from "../test/render";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type {FilterDefinition} from "../types";
import { FilterBar } from "./filter-bar.tsx";

const definitions: FilterDefinition[] = [
  { key: "status", label: "Status", type: "select", options: ["All", "Waiting"], classification: "operational" },
  { key: "branch", label: "Branch", type: "select", options: ["All", "AD01"], classification: "operational" },
  { key: "recordName", label: "Record name", type: "text", classification: "phi" },
];

const noop = () => undefined;
const render_ = (over: Partial<Parameters<typeof FilterBar>[0]> = {}) =>
  render(<FilterBar definitions={definitions} values={{}} sensitiveKeys={[]} onChange={noop} onReset={noop} {...over} />);

describe("FilterBar", () => {
  test("draws a control per filter, labelled", () => {
    render_();
    expect(screen.getByLabelText("Status")).toBeVisible();
    expect(screen.getByLabelText("Record name")).toBeVisible();
  });

  test("changing one reports the key and the value", async () => {
    const onChange = vi.fn();
    render_({ onChange });
    await userEvent.type(screen.getByLabelText("Record name"), "M");
    expect(onChange).toHaveBeenCalledWith("recordName", "M");
  });

  /* A sensitive field looks different, and says why. Without it a user cannot
     tell which of these will survive being shared, and finds out by sharing
     one that does not. */
  test("a sensitive filter is marked as staying out of the link", () => {
    render_();
    expect(screen.getByLabelText("Record name")).toHaveAccessibleDescription(/not.*(link|url|shared)/i);
    expect(screen.getByLabelText("Status")).not.toHaveAccessibleDescription(/not.*(link|url)/i);
  });

  describe("sharing", () => {
    test("with only operational filters, copying the address is enough", async () => {
      const onCopyLink = vi.fn();
      render_({ values: { status: "Waiting" }, onCopyLink });
      await userEvent.click(screen.getByRole("button", { name: /copy link/i }));
      expect(onCopyLink).toHaveBeenCalledOnce();
      expect(screen.queryByRole("button", { name: /saved view/i })).toBeNull();
    });

    /* The branch in the diagram. Sensitive filters cannot travel in a URL, so
       the only honest share is a server-side view behind an opaque id — and
       offering "copy link" there would hand someone a link that silently drops
       half the filters. */
    test("with a sensitive filter, a saved view replaces the link", async () => {
      const onSaveView = vi.fn();
      render_({ values: { status: "Waiting", recordName: "Maya Thomas" }, sensitiveKeys: ["recordName"], onSaveView });
      expect(screen.queryByRole("button", { name: /copy link/i })).toBeNull();
      await userEvent.click(screen.getByRole("button", { name: /saved view/i }));
      expect(onSaveView).toHaveBeenCalledOnce();
    });

    test("and it says why, rather than just changing the button", () => {
      render_({ values: { recordName: "Maya Thomas" }, sensitiveKeys: ["recordName"], onSaveView: noop });
      expect(screen.getByText(/cannot be put in a link|not.*in a link/i)).toBeVisible();
    });

    test("nothing filtered, nothing to share", () => {
      render_({ onCopyLink: noop, onSaveView: noop });
      expect(screen.queryByRole("button", { name: /copy link|saved view/i })).toBeNull();
    });

    /* A worklist's search box lives ABOVE this bar and is not one of `values`,
       so a name typed into it made the share row vanish entirely — nothing to
       copy, and no offer to save the view that could carry it. */
    test("something held back is something to share, even from outside this bar", () => {
      render_({ values: {}, sensitiveKeys: ["query"], onCopyLink: noop, onSaveView: noop });
      expect(screen.getByRole("button", { name: /saved view/i })).toBeVisible();
      expect(screen.queryByRole("button", { name: /copy link/i })).toBeNull();
    });
  });

  /* The advanced group the old FilterPanel had. Collapsed by default, because
     six more controls open on every worklist is six more things between the
     user and the table. */
  describe("advanced filters", () => {
    const advanced: FilterDefinition[] = [
      { key: "owner", label: "Owner", type: "select", options: ["All", "Maya"], classification: "operational" },
      { key: "privateRef", label: "Private reference", type: "text", classification: "phi" },
    ];

    test("are hidden until asked for", () => {
      render_({ advanced });
      expect(screen.queryByLabelText("Owner")).toBeNull();
      expect(screen.getByRole("button", { name: /advanced/i })).toHaveAttribute("aria-expanded", "false");
    });

    test("open on request", async () => {
      render_({ advanced });
      await userEvent.click(screen.getByRole("button", { name: /advanced/i }));
      expect(screen.getByLabelText("Owner")).toBeVisible();
      expect(screen.getByRole("button", { name: /advanced/i })).toHaveAttribute("aria-expanded", "true");
    });

    /* A filter set in a collapsed section is a filtered list with nothing on
       screen saying why. */
    test("say how many are set while closed", () => {
      render_({ advanced, values: { owner: "Maya", privateRef: "PRIVATE-001" } });
      expect(screen.getByRole("button", { name: /advanced/i })).toHaveAccessibleName(/2/);
    });

    test("a sensitive advanced filter is marked like any other", async () => {
      render_({ advanced });
      await userEvent.click(screen.getByRole("button", { name: /advanced/i }));
      expect(screen.getByLabelText("Private reference")).toHaveAccessibleDescription(/not.*(link|url)/i);
    });

    /* And it counts toward the share decision — the branch does not care which
       section a sensitive filter came from. */
    test("a sensitive advanced filter forces the saved-view path", () => {
      render_({ advanced, values: { privateRef: "PRIVATE-001" }, sensitiveKeys: ["privateRef"], onCopyLink: noop, onSaveView: noop });
      expect(screen.queryByRole("button", { name: /copy link/i })).toBeNull();
      expect(screen.getByRole("button", { name: /saved view/i })).toBeVisible();
    });
  });

  test("apply is offered when the caller wants one", async () => {
    const onApply = vi.fn();
    render_({ onApply });
    await userEvent.click(screen.getByRole("button", { name: /^apply$/i }));
    expect(onApply).toHaveBeenCalledOnce();
  });

  test("reset clears everything", async () => {
    const onReset = vi.fn();
    render_({ values: { status: "Waiting" }, onReset });
    await userEvent.click(screen.getByRole("button", { name: /reset/i }));
    expect(onReset).toHaveBeenCalledOnce();
  });
});

/**
 * Reference-fed selects.
 *
 * A select whose options are static needs none of this. One fed from the server
 * does: an empty branch dropdown means "this tenant has no branches" or "the
 * branch service is down", which look identical and mean opposite things — one
 * a setup task, one an incident.
 */
describe("reference data", () => {
  const healthy = {
    references: { branches: [{ value: "hq", label: "Abu Dhabi HQ" }, { value: "dubai", label: "Dubai" }] },
    failures: [],
  };
  const broken = { references: { branches: [] }, failures: [{ key: "branches", code: "REFERENCE_LOAD_FAILED" }] };
  const keys = { branch: "branches" };

  test("a healthy list supplies the options the server sent", () => {
    render_({ reference: healthy, referenceKeys: keys });
    expect(screen.getByRole("option", { name: "Abu Dhabi HQ" })).toBeInTheDocument();
    /* And the config's own options are not used for that field. */
    expect(screen.queryByRole("option", { name: "AD01" })).toBeNull();
  });

  test("a healthy list says nothing", () => {
    render_({ reference: healthy, referenceKeys: keys });
    expect(screen.queryByRole("status")).toBeNull();
  });

  /* Naming it is the point. "Some reference data is unavailable" leaves the
     user to work out which of the dropdowns is lying, and they will guess
     whichever is empty — which may be the one that is genuinely empty. */
  test("a broken list is named, by the label the user can see", () => {
    render_({ reference: broken, referenceKeys: keys });
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("could not be loaded");
    expect(notice).toHaveTextContent("Branch");
  });

  /* A failed list DISABLES the control. Leaving it enabled invites someone to
     conclude the value is genuinely absent and save without it, which is a
     wrong record written because of a transient outage. */
  test("and the field it belongs to is disabled and says so", () => {
    render_({ reference: broken, referenceKeys: keys });
    expect(screen.getByLabelText("Branch")).toBeDisabled();
    /* Said twice on purpose — once in the banner and once at the control. A
       user staring at an empty dropdown is looking at the field, not at a
       banner that may have scrolled away. */
    expect(screen.getByText(/^Branch could not be loaded/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("could not be loaded");
  });

  test("the other filters are untouched by one list failing", () => {
    render_({ reference: broken, referenceKeys: keys });
    expect(screen.getByLabelText("Status")).toBeEnabled();
    expect(screen.getByLabelText("Record name")).toBeEnabled();
  });

  test("retrying is offered, and reports back", async () => {
    const onRetryReference = vi.fn();
    render_({ reference: broken, referenceKeys: keys, onRetryReference });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetryReference).toHaveBeenCalledTimes(1);
  });

  /* A failure for a list this bar does not show is not this bar's business. */
  test("a failure for a list nobody is showing is not reported", () => {
    render_({
      reference: { references: { branches: healthy.references.branches }, failures: [{ key: "insuranceNetworks", code: "REFERENCE_LOAD_FAILED" }] },
      referenceKeys: keys,
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  /* No reference response at all is not the same as one that says the lists are
     broken: with nothing known, the bar behaves exactly as it did before. */
  test("with no reference response the field falls back to its configured options", () => {
    render_({ referenceKeys: keys });
    expect(screen.getByRole("option", { name: "AD01" })).toBeInTheDocument();
    expect(screen.getByLabelText("Branch")).toBeEnabled();
  });

  test("selecting a server-sent option reports the filter key and the value", async () => {
    const onChange = vi.fn();
    render_({ reference: healthy, referenceKeys: keys, onChange });
    await userEvent.selectOptions(screen.getByLabelText("Branch"), "dubai");
    expect(onChange).toHaveBeenCalledWith("branch", "dubai");
  });
});
