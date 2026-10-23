"use client";
import React, {useState, useId} from "react";
import {Button, Input} from "@pepbits/ui";
import {CenterRecordCard, ConfirmDialog, DataValue, Drawer, Modal, PrintDocument, SourceDialog} from "@pepbits/components";
import {useLocalization} from "@pepbits/i18n/react";

export function OverlaysDemo() {
  const {t} = useLocalization();
  const [open,setOpen] = useState<string|null>(null);
  const [confirmed,setConfirmed] = useState(false);
  return <div className="space-y-3"><div className="flex flex-wrap gap-2">
    {["SourceDialog","Modal","Drawer","CenterRecordCard","ConfirmDialog","PrintDocument"].map(name => <Button key={name} onClick={() => setOpen(name)}>{name}</Button>)}
    </div>
    <SourceDialog open={open === "SourceDialog"} onClose={()=>setOpen(null)} title="Details" className="fixed inset-0 z-50 grid place-items-center bg-black/30">{panel=><div ref={panel} tabIndex={-1} className="rounded-[var(--radius)] bg-[var(--surface)] p-6"><Input label="Name"/><Button onClick={()=>setOpen(null)}>{t("Close")}</Button></div>}</SourceDialog>
    <Modal open={open === "Modal"} onClose={() => setOpen(null)} title="Details" footer={<Button onClick={() => setOpen(null)}>{t("Close")}</Button>}><Input label="Name"/></Modal>
    <Drawer open={open === "Drawer"} onClose={() => setOpen(null)} title="Details"><Input label="Notes"/></Drawer>
    <CenterRecordCard open={open === "CenterRecordCard"} onClose={() => setOpen(null)} title="Summary"><DataValue value="DEMO-001"/></CenterRecordCard>
    {open === "PrintDocument" ? <><PrintDocument><h1>{t("Summary")}</h1><DataValue value="DEMO-001"/></PrintDocument><Modal open title="Summary" onClose={()=>setOpen(null)} footer={<Button onClick={()=>window.print()}>{t("Print")}</Button>}><DataValue value="DEMO-001"/></Modal></> : null}
    <ConfirmDialog open={open === "ConfirmDialog"} title="Confirm" message="catalog.confirmDemo" onConfirm={() => {setConfirmed(true);setOpen(null);}} onCancel={() => setOpen(null)}/>
    {confirmed ? <p role="status">{t("catalog.confirmed")}</p> : null}
  </div>;
}

