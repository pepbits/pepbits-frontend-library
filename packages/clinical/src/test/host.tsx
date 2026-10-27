import React, {type ReactElement, type ReactNode} from "react";
import {render as testingRender} from "@testing-library/react";
import {createTranslator, directionOf} from "@pepbits/i18n";
import {LocalizationProvider} from "@pepbits/i18n/react";
import {PreferenceHost, usePreferences} from "@pepbits/preferences/react";
import {PresentationProvider} from "@pepbits/components";
import {ScreenHostProvider, useFormatters, type ScreenHostValue} from "@pepbits/patterns/screen-host";
import {ClinicalProvider} from "../context/clinical-context";
import type {ClinicalDataPort} from "../context/port";
import type {ClinicalActor} from "../types";

function Localized({children, screenHost}: {children: ReactNode; screenHost?: ScreenHostValue}) {
  const {preferences} = usePreferences(), format = useFormatters();
  return <LocalizationProvider value={{language: preferences.language, direction: directionOf(preferences.language),
    t: createTranslator({language: preferences.language, catalogs: {en: {}}}), dateTime: format.dateTime}}>
    <PresentationProvider value={preferences}><ScreenHostProvider value={screenHost}>{children}</ScreenHostProvider></PresentationProvider>
  </LocalizationProvider>;
}

/** Renders inside preferences, localization, a screen host and a clinical provider with the given port. */
export function renderClinical(ui: ReactElement, {port, actor = {role: "nurse", permissions: ["vitals.write"]}, notify = () => {}}: {
  port: ClinicalDataPort; actor?: ClinicalActor; notify?: ScreenHostValue["notify"];
}) {
  return testingRender(<PreferenceHost preferences={{}} update={() => {}}>
    <Localized screenHost={{notify} as ScreenHostValue}><ClinicalProvider port={port} actor={actor}>{ui}</ClinicalProvider></Localized>
  </PreferenceHost>);
}
