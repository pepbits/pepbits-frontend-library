import { render, screen } from "./test/render";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { Button, IconButton } from "./button";

describe("Button", () => {
  test("calls its handler when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  test("a disabled button does not call its handler", async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  /* `loading` is the one people get wrong. A spinner that leaves the button
     clickable submits the form twice, and the second submit is the one that
     creates the duplicate record. */
  test("a loading button cannot be clicked", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  test("keeps its label while loading, so the button does not resize", () => {
    render(<Button loading>Save draft</Button>);
    expect(screen.getByText("Save draft")).toBeInTheDocument();
  });
});

describe("IconButton", () => {
  /* An icon-only control with no accessible name is a button a screen reader
     announces as "button" and nothing else. */
  test("is reachable by its label", async () => {
    const onClick = vi.fn();
    render(<IconButton label="Remove row" onClick={onClick}><span aria-hidden>x</span></IconButton>);
    await userEvent.click(screen.getByRole("button", { name: "Remove row" }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
