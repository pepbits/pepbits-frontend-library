"use client";
import React, {useState, useId} from "react";
import {FilePicker} from "@pepbits/ui";
import {DataValue} from "@pepbits/components";
import {LocalizedText} from "@pepbits/i18n/react";

export function FileDemo() {
  const [file, setFile] = useState<File | null>(null);
  return <div className="space-y-3"><FilePicker label="Choose file" onFile={setFile} accept=".csv,.txt" />
    <DataValue value={file?.name} /><p><LocalizedText message="catalog.fileHint" /></p></div>;
}

