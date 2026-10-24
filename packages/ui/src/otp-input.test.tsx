import {useState} from "react";
import {fireEvent, render, screen} from "./test/render";
import {LocalizationProvider} from "@pepbits/i18n/react";
import {expect, test, vi} from "vitest";
import {OtpInput} from "./otp-input";

function Harness({onComplete, rtl = false}: {onComplete?: (value: string) => void; rtl?: boolean}) {
  const [value, setValue] = useState("");
  const input = <OtpInput label="Sign-in code" value={value} onChange={setValue} onComplete={onComplete} describedBy="code-error"/>;
  return <>{rtl ? <LocalizationProvider value={{language: "ar", direction: "rtl", t: message => message, dateTime: String}}>{input}</LocalizationProvider> : input}<output data-testid="value">{value}</output></>;
}
const boxes = () => screen.getAllByRole("textbox");

test("typing advances, completes once and ignores non-digits", () => {
  const onComplete = vi.fn();
  render(<Harness onComplete={onComplete}/>);
  expect(screen.getByRole("group", {name: "Sign-in code"})).toHaveAttribute("aria-describedby", "code-error");
  expect(boxes()).toHaveLength(6);
  expect(boxes()[0]).toHaveAccessibleName("Digit 1 of 6");
  fireEvent.change(boxes()[0]!, {target: {value: "a"}});
  expect(screen.getByTestId("value")).toHaveTextContent("");
  "123456".split("").forEach((digit, index) => fireEvent.change(boxes()[index]!, {target: {value: digit}}));
  expect(screen.getByTestId("value")).toHaveTextContent("123456");
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onComplete).toHaveBeenCalledWith("123456");
});

test("paste spreads digits and backspace clears then moves back", () => {
  render(<Harness/>);
  fireEvent.paste(boxes()[0]!, {clipboardData: {getData: () => "12 34"}});
  expect(screen.getByTestId("value")).toHaveTextContent("1234");
  expect(boxes()[4]).toHaveFocus();
  fireEvent.keyDown(boxes()[4]!, {key: "Backspace"});
  expect(screen.getByTestId("value")).toHaveTextContent("123");
  expect(boxes()[3]).toHaveFocus();
});

test("arrow keys follow reading direction", () => {
  const view = render(<Harness/>);
  boxes()[2]!.focus();
  fireEvent.keyDown(boxes()[2]!, {key: "ArrowLeft"});
  expect(boxes()[1]).toHaveFocus();
  view.unmount();
  render(<Harness rtl/>);
  boxes()[2]!.focus();
  fireEvent.keyDown(boxes()[2]!, {key: "ArrowLeft"});
  expect(boxes()[3]).toHaveFocus();
});

test("native deletion clears a digit and completing an unchanged code does not repeat the callback", () => {
  const onComplete = vi.fn();
  render(<Harness onComplete={onComplete}/>);
  fireEvent.paste(boxes()[0]!, {clipboardData: {getData: () => "123456"}});
  fireEvent.change(boxes()[5]!, {target: {value: "6"}});
  expect(onComplete).toHaveBeenCalledTimes(1);
  fireEvent.change(boxes()[2]!, {target: {value: ""}});
  expect(screen.getByTestId("value")).toHaveTextContent("12456");
});

test("typing beyond the first empty box appends without skipping focus", () => {
  render(<Harness/>);
  fireEvent.change(boxes()[4]!, {target: {value: "7"}});
  expect(boxes()[0]).toHaveValue("7");
  expect(boxes()[1]).toHaveFocus();
});
