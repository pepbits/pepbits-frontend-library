'use client';
import {DiagnosticBarcode} from '@pepbits/reference-diagnostics';
export function Barcode({value,height=36}:{value:string;height?:number;width?:number;fontSize?:number;displayValue?:boolean}){return <DiagnosticBarcode value={value} height={height}/>;}
