import React from "react";
import { render, screen } from "./test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { CenterRecordCard, ConfirmDialog, Drawer, Modal } from "./overlay";
import { DropdownSelect } from "./dropdown";
import { SearchSelect } from "@pepbits/ui";

describe("Modal", () => {
  test("renders nothing at all when closed", () => {
    const { container } = render(<Modal open={false} onClose={() => undefined} title="Schedule report"><p>Body</p></Modal>);
    expect(container).toBeEmptyDOMElement();
  });

  /* A dialog with no accessible name is announced as just "dialog". The title
     is on screen, but nothing connects it to the role. */
  test("is a modal dialog named by its title", () => {
    render(<Modal open onClose={() => undefined} title="Schedule report"><p>Body</p></Modal>);
    const dialog = screen.getByRole("dialog", { name: "Schedule report" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  test("Escape closes it", async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Schedule report"><p>Body</p></Modal>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  /* The listener is bound to window, so it has to be removed on close or every
     modal ever opened stays subscribed and one Escape fires all of them. */
  test("stops listening for Escape once closed", async () => {
    const onClose = vi.fn();
    const { rerender } = render(<Modal open onClose={onClose} title="Schedule report"><p>Body</p></Modal>);
    rerender(<Modal open={false} onClose={onClose} title="Schedule report"><p>Body</p></Modal>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  test("clicking the backdrop closes it, clicking the panel does not", async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Schedule report"><p>Body text</p></Modal>);
    await userEvent.click(screen.getByText("Body text"));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("the close button says what it does", async () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} title="Schedule report"><p>Body</p></Modal>);
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("Drawer", () => {
  test("is a modal dialog named by its title", () => {
    render(<Drawer open onClose={() => undefined} title="Filters"><p>Body</p></Drawer>);
    expect(screen.getByRole("dialog", { name: "Filters" })).toHaveAttribute("aria-modal", "true");
  });

  test("Escape closes it", async () => {
    const onClose = vi.fn();
    render(<Drawer open onClose={onClose} title="Filters"><p>Body</p></Drawer>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  /* Written per overlay rather than once for Modal. The shared hook took a ref
     that the Drawer never attached, so the panel was always null: Escape still
     worked, focus never moved in, and the Tab trap quietly did nothing. Only
     Modal had a focus test, so all of it passed. */
  test("focus moves into the panel and Tab stays there", async () => {
    render(<Drawer open onClose={() => undefined} title="Filters" footer={<button type="button">Apply</button>}><button type="button">Inside</button></Drawer>);
    expect(screen.getByRole("dialog").firstElementChild).toHaveFocus();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });
});

describe("CenterRecordCard", () => {
  /* Three overlays that look alike to a sighted user should not be three
     different things to a screen reader. */
  test("is a dialog named by its title", () => {
    render(<CenterRecordCard open onClose={() => undefined} title="Journal entry"><p>Body</p></CenterRecordCard>);
    expect(screen.getByRole("dialog", { name: "Journal entry" })).toBeVisible();
  });

  test("Escape closes it", async () => {
    const onClose = vi.fn();
    render(<CenterRecordCard open onClose={onClose} title="Journal entry"><p>Body</p></CenterRecordCard>);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("focus moves into the panel and Tab stays there", async () => {
    render(<CenterRecordCard open onClose={() => undefined} title="Journal entry" footer={<button type="button">Post</button>}><button type="button">Inside</button></CenterRecordCard>);
    expect(screen.getByRole("dialog").firstElementChild).toHaveFocus();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
  });
});

describe("ConfirmDialog", () => {
  test("asks the question and offers both answers", () => {
    render(<ConfirmDialog open title="Delete 3 records?" message="This cannot be undone." confirmLabel="Delete" tone="danger" onConfirm={() => undefined} onCancel={() => undefined} />);
    expect(screen.getByRole("dialog", { name: "Delete 3 records?" })).toBeVisible();
    expect(screen.getByText("This cannot be undone.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeVisible();
  });

  /* Confirm and cancel must not be wired to the same handler -- the bug that
     turns "are you sure?" into a second delete button. */
  test("confirm and cancel are different answers", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Delete 3 records?" message="This cannot be undone." confirmLabel="Delete" onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  /* Escape is a cancel, never a confirm. */
  test("Escape cancels rather than confirms", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Delete 3 records?" message="Gone for good." onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

/* aria-modal="true" tells assistive tech the rest of the page is inert. These
   pin the behaviour that makes that true, rather than a claim. */
describe("Modal focus handling", () => {
  function Harness() {
    const [open, setOpen] = React.useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>Open</button>
        <Modal open={open} onClose={() => setOpen(false)} title="Schedule report" footer={<button type="button">Save</button>}>
          <button type="button">Inside</button>
        </Modal>
      </>
    );
  }

  test("focus moves into the dialog when it opens", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("dialog").firstElementChild).toHaveFocus();
  });

  /* Without this, closing drops focus to the document body and the next Tab
     restarts from the top of the page -- somewhere the user has never been. */
  test("focus returns to whatever opened it", async () => {
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open" });
    await userEvent.click(opener);
    await userEvent.keyboard("{Escape}");
    expect(opener).toHaveFocus();
  });

  /* React applies a child's autoFocus during commit, before the parent's
     effects run. A dialog that focuses its panel unconditionally therefore
     takes focus straight back off the field the caller asked for -- which is
     the command palette opening with the caret nowhere. */
  test("leaves a child's own autoFocus alone", async () => {
    function WithInput() {
      const [open, setOpen] = React.useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>Open</button>
          <Modal open={open} onClose={() => setOpen(false)} title="Open page">
            <input autoFocus aria-label="Search pages" />
          </Modal>
        </>
      );
    }
    render(<WithInput />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("textbox", { name: "Search pages" })).toHaveFocus();
    await userEvent.keyboard("journal");
    expect(screen.getByRole("textbox", { name: "Search pages" })).toHaveValue("journal");
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("textbox", { name: "Search pages" })).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Open" })).toHaveFocus();
  });

  test("Tab cycles inside the panel instead of escaping to the page", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    const close = screen.getByRole("button", { name: "Close" });
    const inside = screen.getByRole("button", { name: "Inside" });
    const save = screen.getByRole("button", { name: "Save" });
    await userEvent.tab();
    expect(close).toHaveFocus();
    await userEvent.tab();
    expect(inside).toHaveFocus();
    await userEvent.tab();
    expect(save).toHaveFocus();
    await userEvent.tab();
    expect(close).toHaveFocus();
  });

  test("Shift+Tab off the front wraps to the back", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
  });
});

/* Modal listens for Escape on window, while a dropdown inside it handles the
   same key on a React synthetic event. Those are different listeners on
   different nodes, so "one Escape, two things dismissed" -- the menu AND the
   half-filled form around it -- is the default outcome unless the inner
   handler stops the native event as well. Reasoning about React's delegation
   root is not proof; this is. */
describe("Escape inside a dialog", () => {
  const options = [{ value: "a", label: "GBP" }, { value: "b", label: "USD" }];

  test("closes an open DropdownSelect without closing the Modal", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="New invoice">
        <DropdownSelect label="Currency" value="a" options={options} onChange={() => undefined} />
      </Modal>,
    );
    await userEvent.click(screen.getByRole("button", { name: /^Currency / }));
    expect(screen.getAllByRole("option")).toHaveLength(2);
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("option")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    /* A second Escape, with nothing left open inside, does close the dialog. */
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });

  test("closes an open SearchSelect without closing the Modal", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="New invoice">
        <SearchSelect label="Currency" value="a" options={options} onChange={() => undefined} />
      </Modal>,
    );
    await userEvent.click(screen.getByRole("button", { name: /^Currency / }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("option")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });
});

test("Escape closes only the top dialog and restores its nested trigger", async () => {
  function Example() {
    const [open,setOpen]=React.useState(false),[confirm,setConfirm]=React.useState(false);
    return <><button onClick={()=>setOpen(true)}>Open parent</button><Modal open={open} onClose={()=>setOpen(false)} title="Parent"><button onClick={()=>setConfirm(true)}>Delete item</button></Modal><ConfirmDialog open={confirm} title="Confirm delete" message="Delete?" onCancel={()=>setConfirm(false)} onConfirm={()=>setConfirm(false)} /></>;
  }
  render(<Example />);
  await userEvent.click(screen.getByRole("button",{name:"Open parent"}));
  await userEvent.click(screen.getByRole("button",{name:"Delete item"}));
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog",{name:"Confirm delete"})).not.toBeInTheDocument();
  expect(screen.getByRole("dialog",{name:"Parent"})).toBeVisible();
  expect(screen.getByRole("button",{name:"Delete item"})).toHaveFocus();
  await userEvent.keyboard("{Escape}");
  expect(screen.getByRole("button",{name:"Open parent"})).toHaveFocus();
});
