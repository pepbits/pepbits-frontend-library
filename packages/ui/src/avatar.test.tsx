import { fireEvent, render, screen } from "./test/render";
import { describe, expect, test } from "vitest";
import { Avatar, initialsOf } from "./avatar";

describe("initialsOf", () => {
  test("takes the first letter of the first and last word", () => {
    expect(initialsOf("Aisha Rahman")).toBe("AR");
    expect(initialsOf("Maya Elizabeth Thomas")).toBe("MT");
  });

  test("one word gives one letter", () => {
    expect(initialsOf("Prakash")).toBe("P");
  });

  test("nothing gives nothing to draw", () => {
    expect(initialsOf("")).toBe("");
    expect(initialsOf("   ")).toBe("");
  });
});

describe("Avatar", () => {
  /* The name is what identifies the person; the initials are a drawing of it.
     A circle reading "AR" and nothing else is two people in any large tenant. */
  test("carries the full name, not just the initials", () => {
    render(<Avatar name="Aisha Rahman" />);
    expect(screen.getByLabelText("Aisha Rahman")).toBeVisible();
    expect(screen.getByText("AR")).toBeVisible();
  });

  /* Colour is a memory aid, so it has to survive sorting and filtering — it is
     derived from the name, never from a row index. */
  test("the same person keeps the same colour", () => {
    const { container: first } = render(<Avatar name="Aisha Rahman" />);
    const { container: second } = render(<Avatar name="Aisha Rahman" />);
    expect(first.firstElementChild?.className).toBe(second.firstElementChild?.className);
  });

  /* Not "these two differ" — with five washes some pairs collide and that is
     the honest cost of a palette chosen for contrast rather than for variety.
     What must hold is that the colour varies at all. The first version of this
     test asserted a specific pair and failed on the first two names tried. */
  test("the palette is actually used", () => {
    const names = ["Aisha Rahman", "Omar Khan", "Maya Thomas", "Leena George", "Ibrahim Noor", "Sara Ahmed"];
    const washes = new Set(names.map((name) => {
      const { container } = render(<Avatar name={name} />);
      return container.firstElementChild?.className;
    }));
    expect(washes.size).toBeGreaterThanOrEqual(3);
  });

  /* A photo that fails to load must leave the initials, not a broken image
     icon or an empty hole where a face was. */
  test("a photo falls back to initials when it fails", () => {
    render(<Avatar name="Aisha Rahman" src="/nope.png" />);
    /* fireEvent, not dispatchEvent: React's onError is a synthetic handler and a
       raw event neither reaches it nor flushes the re-render it causes. */
    fireEvent.error(screen.getByRole("img", { name: "Aisha Rahman" }));
    expect(screen.getByText("AR")).toBeVisible();
  });

  test("a photo is described by the person's name", () => {
    render(<Avatar name="Aisha Rahman" src="/portrait.png" />);
    expect(screen.getByRole("img", { name: "Aisha Rahman" })).toBeVisible();
  });

  /* A notification row carries "AR" and never the person it stands for.
     Deriving "A" from "AR" would be worse than using what is there. */
  test("takes initials directly when that is all the data has", () => {
    render(<Avatar name="AR" initials="AR" decorative />);
    expect(screen.getByText("AR")).toBeVisible();
  });

  /* Inside a button that already says who it is, a second announcement of the
     same name is noise. */
  test("it can be decorative when something else names the person", () => {
    render(<button type="button" aria-label="Open profile menu"><Avatar name="Aisha Rahman" decorative /></button>);
    expect(screen.queryByLabelText("Aisha Rahman")).toBeNull();
    expect(screen.getByRole("button", { name: "Open profile menu" })).toBeVisible();
  });
});
