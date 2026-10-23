import React from 'react';
import {notFound} from 'next/navigation';
import {areas,type AreaId} from '../../areas';
import {GalleryPage} from '../../gallery';
export function generateStaticParams(){return areas.map(area=>({area:area.id}));}
export default async function Page({params}:{params:Promise<{area:string}>}){const {area}=await params;if(!areas.some(item=>item.id===area))notFound();return <GalleryPage area={area as AreaId}/>;}
