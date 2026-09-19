'use client';
import React from 'react';
import {Button,Input} from '@pepbits/ops-ui';
import {useLocalization} from '@pepbits/ops-ui';
export function PricingExpressionInput({value,onChange,disabled=false,id,'aria-describedby':description}:{value:string;onChange(value:string):void;disabled?:boolean;id?:string;'aria-describedby'?:string}){
 const {t}=useLocalization();
 return <div><Input id={id} aria-describedby={description} value={value} onChange={e=>onChange(e.target.value)} disabled={disabled} maxLength={2000} spellCheck={false}/><div className="actions"><Button type="button" disabled={disabled} onClick={()=>onChange('base_price')}>{t("Base price")}</Button><Button type="button" disabled={disabled} onClick={()=>onChange('base_price * (1 + percent / 100)')}>{t("Percentage markup")}</Button><Button type="button" disabled={disabled} onClick={()=>onChange('base_price * (1 - percent / 100)')}>{t("Percentage discount")}</Button><Button type="button" disabled={disabled} onClick={()=>onChange('cost * (1 + percent / 100)')}>{t("Cost plus")}</Button></div><p>{t("Expression returns a unit price; quantity is multiplied afterwards. Inputs: base_price, percent, cost, quantity. Use arithmetic, min(a,b), max(a,b), round(value,scale). No scripts. Validate with the server price preview.")}</p></div>;
}
