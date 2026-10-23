"use client";
import React,{useMemo,useState} from 'react';
import {createPageRenderer,UnsupportedPage,SkeletonFor} from '@pepbits/page-engines/renderer';
import {Input,Select} from '@pepbits/ui';
export function RendererDemo(){const [kind,setKind]=useState('item');const Renderer=useMemo(()=>createPageRenderer({renderers:{item:()=> <Input label="Registered item field" defaultValue="Fictional item"/>}}),[]);return <div><Select label="Renderer kind" value={kind} options={[{value:'item',label:'Registered item'},{value:'unknown',label:'Unsupported kind'}]} onChange={event=>setKind(event.target.value)}/><Renderer page={{id:'registered-item',kind,title:'Item',subtitle:'Host registration',module:'gallery'}}/></div>;}
