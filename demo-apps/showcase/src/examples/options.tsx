"use client";
import React,{useState} from 'react';
import {CsvOptionsEditor} from '@pepbits/patterns/imports';
export function OptionsDemo(){const [options,setOptions]=useState('');return <div><CsvOptionsEditor disabled={false} onStage={()=>setOptions('')} onCancel={()=>setOptions('')} onApply={setOptions}/><pre tabIndex={0} role="region" aria-label="Staged options">{options}</pre></div>;}
