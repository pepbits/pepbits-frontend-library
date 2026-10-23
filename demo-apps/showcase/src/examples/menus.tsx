"use client";
import React, {useState, useId} from "react";
import {Button, NavLink} from "@pepbits/ui";
import {ActionMenu, DropdownSelect, MenuButton} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";

export function MenusDemo() {
  const {t} = useLocalization();
  const [value, setValue] = useState("active");
  const [count, setCount] = useState(0);
  return <div className="space-y-3">
    <DropdownSelect label="Status" value={value} options={[{value:"active",label:"Active"},{value:"pending",label:"Pending"}]} onChange={setValue}/>
    <ActionMenu trigger={<Button>{t("Actions")}</Button>}>{close => <MenuButton label="Add" onClick={() => {setCount(count+1);close();}}/>}</ActionMenu>
    <NavLink onClick={() => setCount(count+1)}>{t("Open")}</NavLink>
    <output aria-live="polite">{t("catalog.actionCount",{count})}</output>
  </div>;
}

