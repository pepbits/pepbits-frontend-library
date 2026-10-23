"use client";
import React, {useState, useId} from "react";
import {Avatar, Badge, StatusBadge} from "@pepbits/ui";

export function StatusDemo() {
  return <div className="flex flex-wrap items-center gap-3"><Avatar name="Demo User" size="lg"/>
    {(["neutral","brand","success","warning","danger","info","violet"] as const).map(tone => <Badge key={tone} tone={tone}>{tone}</Badge>)}
    <StatusBadge value="Approved"/><StatusBadge value={false}/></div>;
}

