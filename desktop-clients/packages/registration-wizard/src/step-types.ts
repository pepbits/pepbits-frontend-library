import type { ListState } from "./lists";
import type { Errors, StepId } from "./registration";
import type { CountryOption, CurrencyOption, Offer, Option, RegistrationData, RegistrationHost } from "./types";

export type SetData = (fn: (d: RegistrationData) => RegistrationData) => void;

export interface WizardLists {
  facilityTypes: ListState<Option>;
  careSettings: ListState<Option>;
  specialties: ListState<Option>;
  administratorRoles: ListState<Option>;
  countries: ListState<CountryOption>;
  states: ListState<Option>;
  districts: ListState<Option>;
  timeZones: ListState<Option>;
  currencies: ListState<CurrencyOption>;
  offers: ListState<Offer>;
}

export interface StepProps {
  data: RegistrationData;
  errors: Errors;
  setData: SetData;
  onJump?: (id: StepId) => void;
  lists: WizardLists;
  host: RegistrationHost;
}
