import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModalDialog, SideDrawer } from "./dialog";

afterEach(cleanup);

describe("original RCM dialog frames", () => {
  it("side drawer keeps the source 620px frame, icon, header and footer, traps focus and restores the opener", () => {
    const onClose = vi.fn();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const view = render(<SideDrawer open onClose={onClose} title="New invoice" subtitle="Starts as draft." icon={<svg data-testid="icon" />} footer={<button>Create</button>}><input aria-label="Amount" /></SideDrawer>);
    const dialog = screen.getByRole("dialog", { name: "New invoice" });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    const panel = dialog.querySelector<HTMLElement>("[class*='w-[min(620px,100%)]']")!;
    expect(panel.className).toContain("shadow-drawer");
    expect(panel).toHaveFocus();
    expect(screen.getByTestId("icon").parentElement?.className).toContain("rounded-xl");
    expect(screen.getByRole("heading", { name: "New invoice" })).toBeTruthy();
    const close = screen.getByRole("button", { name: "Close" });
    const create = screen.getByRole("button", { name: "Create" });
    create.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(window, {key: "Tab", shiftKey: true});
    expect(create).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    view.rerender(<SideDrawer open={false} onClose={onClose} title="New invoice">x</SideDrawer>);
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("modal keeps the source max-460px rounded-2xl p-5 frame with subject above the title", () => {
    render(<ModalDialog open onClose={() => {}} title="Approve" subject="INV-1" footer={<button>Go</button>}>body</ModalDialog>);
    const panel = screen.getByRole("dialog", { name: "Approve" }).querySelector<HTMLElement>(".max-w-\\[460px\\]")!;
    expect(panel.className).toContain("rounded-2xl");
    expect(panel.className).toContain("p-5");
    expect(screen.getByText("INV-1").nextElementSibling?.textContent).toBe("Approve");
  });

  it.each([
    ["drawer", (onClose: () => void) => <SideDrawer open busy onClose={onClose} title="T">x</SideDrawer>],
    ["modal", (onClose: () => void) => <ModalDialog open busy onClose={onClose} title="T">x</ModalDialog>],
  ])("%s ignores Escape and scrim clicks while busy but stays open", (_name, make) => {
    const onClose = vi.fn();
    render(make(onClose));
    fireEvent.keyDown(window, { key: "Escape" });
    const scrim = screen.getByRole("dialog").querySelector<HTMLElement>(":scope > [aria-hidden]")!;
    fireEvent.mouseDown(scrim);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("scrim click closes when idle", () => {
    const onClose = vi.fn();
    render(<ModalDialog open onClose={onClose} title="T">x</ModalDialog>);
    fireEvent.mouseDown(screen.getByRole("dialog").querySelector<HTMLElement>(":scope > [aria-hidden]")!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
