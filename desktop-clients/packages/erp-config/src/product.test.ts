import { describe, expect, test } from "vitest";
import { canProductAction, productForRole, defineProduct, LEDGER_PRODUCT, NEXORA_PRODUCT, moduleLandingPage } from "./product.ts";
import { MODULES, PAGE_REGISTRY } from "./navigation.ts";

describe("product profiles", () => {
  test("the default profile retains the existing catalog", () => {
    expect(NEXORA_PRODUCT.modules).toEqual(MODULES);
    expect(Object.keys(NEXORA_PRODUCT.pages)).toEqual(Object.keys(PAGE_REGISTRY));
  });
  test("a finance product excludes other domains while retaining shared utilities", () => {
    expect(Object.keys(LEDGER_PRODUCT.modules)).toEqual(["finance"]);
    expect(LEDGER_PRODUCT.pages["finance-dashboard"]).toBeDefined();
    expect(LEDGER_PRODUCT.pages["preferences"]).toBeDefined();
    expect(LEDGER_PRODUCT.pages["hr-dashboard"]).toBeUndefined();
    expect(Object.values(LEDGER_PRODUCT.pages).every(p => p.module === "finance" || p.module === "shared")).toBe(true);
  });
  test("rejects a landing module that would have no navigation", () => {
    expect(() => defineProduct({ id: "broken", name: "Broken", tagline: "", defaultModule: "hr", enabledModules: ["finance"] })).toThrow(/default module/);
  });
  test("profiles are isolated from the default catalog membership", () => {
    expect(Object.keys(NEXORA_PRODUCT.modules)).toHaveLength(8);
    expect(Object.keys(LEDGER_PRODUCT.modules)).toHaveLength(1);
  });
});

test("host-defined modules open a registered page without an invented dashboard",()=>{
 const product={...LEDGER_PRODUCT,defaultModule:"patient-administration",modules:{"patient-administration":{...MODULES.finance,id:"patient-administration",navigation:[{id:"patients",label:"Patients",items:[{id:"missing",pageId:"missing",label:"Unavailable"},{id:"search",pageId:"patient-search",label:"Patient search"}]}]}},pages:{"patient-search":{id:"patient-search",title:"Patient search",subtitle:"",module:"patient-administration",kind:"dashboard" as const}}};
 expect(moduleLandingPage(product,"patient-administration")).toBe("patient-search");
 expect(moduleLandingPage(product,"unavailable")).toBeUndefined();
 expect(moduleLandingPage(LEDGER_PRODUCT,"finance")).toBe("finance-dashboard");
});


test("page selection and role rules prune nested navigation without changing the catalog", () => {
  const product=defineProduct({id:"acme",name:"ACME",tagline:"",defaultModule:"finance",enabledModules:["finance"],enabledPages:["customer-master"],pageTitles:{"customer-master":"Customers"},access:{pages:{"customer-master":["manager"]},actions:{edit:["manager"],archive:[]}}});
  const denied=productForRole(product,"viewer");
  expect(denied.pages["customer-master"]).toBeUndefined();
  expect(JSON.stringify(denied.modules)).not.toContain('"pageId":"customer-master"');
  expect(canProductAction(denied,"edit")).toBe(false);
  expect(canProductAction(productForRole(product),"edit")).toBe(false);
  const manager=productForRole(product,"manager");
  expect(manager.pages["customer-master"].title).toBe("Customers");
  expect(canProductAction(manager,"edit")).toBe(true);
  expect(canProductAction(manager,"archive")).toBe(false);
  expect(NEXORA_PRODUCT.pages["customer-master"].title).toBe("Customer Master");
  expect(product.pages["customer-master"]).toBeDefined();
  expect(manager.pages["finance-dashboard"]).toBeDefined();
});
test("starter configuration rejects unknown pages and malformed permission rules", () => {
  const base={id:"test",name:"Test",tagline:"",defaultModule:"finance" as const,enabledModules:["finance"] as const};
  expect(()=>defineProduct({...base,enabledPages:["missing"]})).toThrow(/page/);
  expect(()=>defineProduct({...base,pageTitles:{missing:"Other"}})).toThrow(/title/);
  expect(()=>defineProduct({...base,access:{actions:{edit:[""]}}})).toThrow(/role/);
});
