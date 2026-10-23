"use client";
import React, {useState} from 'react';
import {Table,TableHeader,TableBody,TableFooter,TableRow,TableHead,TableCell,TableCaption,TableContainer,DataValue,Pagination,PresentationProvider,presentationFromPreferences,usePresentationPreferences} from '@pepbits/components';
import {usePreferences,usePreference} from '@pepbits/preferences/react';
import {useFormatters} from '@pepbits/patterns/screen-host';
export function TableDemo(){
 const {preferences}=usePreferences(),pageSize=usePreference('pageSize'),format=useFormatters();
 const [page,setPage]=useState(1);
 const current=Math.min(page,Math.ceil(53/pageSize.value));
 const rows=Array.from({length:53},(_,index)=>({id:`ITEM-${index+1}`,amount:(index+1)*12.5})).slice((current-1)*pageSize.value,current*pageSize.value);
 return <PresentationProvider value={presentationFromPreferences(preferences)}><TableContainer><Table><TableCaption>Fictional items</TableCaption><TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader><TableBody>{rows.map(row=><TableRow key={row.id}><TableCell>{row.id}</TableCell><TableCell><DataValue value={row.amount} format={format.money}/></TableCell></TableRow>)}</TableBody><TableFooter><TableRow><TableCell colSpan={2}>{format.number(53)} items</TableCell></TableRow></TableFooter></Table></TableContainer>
 <Pagination page={current} pageSize={pageSize.value} total={53} onPageChange={setPage} pageSizeDisabled={pageSize.locked} allowedPageSizes={pageSize.allowedValues} onPageSizeChange={value=>{pageSize.update({pageSize:value});setPage(1);}}/><PresentationReadout/></PresentationProvider>;
}
function PresentationReadout(){const presentation=usePresentationPreferences();return <output>{presentation?.density}</output>;}
