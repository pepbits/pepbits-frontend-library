import React from "react";
import {render as renderWithOptions, type RenderOptions} from "@testing-library/react";
import {createTranslator} from "@pepbits/i18n";
import {LocalizationProvider} from "@pepbits/i18n/react";
import {messages} from "./messages";
export * from "@testing-library/react";

const localization = {language: "en", direction: "ltr" as const,
  t: createTranslator({language: "en", catalogs: {en: messages}}), dateTime: String};
/** A consumer supplies its generic UI labels; tests keep the original visible assertions. */
export function render(ui: React.ReactNode, options: RenderOptions = {}) {
  const Wrapper = options.wrapper;
  return renderWithOptions(ui, {...options, wrapper: ({children}) =>
    <LocalizationProvider value={localization}>
      {Wrapper ? <Wrapper>{children}</Wrapper> : children}
    </LocalizationProvider>});
}
