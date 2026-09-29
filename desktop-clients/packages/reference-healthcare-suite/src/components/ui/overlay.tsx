'use client';
import {Modal as OpsModal} from '@pepbits/ops-ui';
import {Children,isValidElement,type ReactNode} from 'react';
/** Keep the source's readable title when it includes a decorative Lucide icon. */
function titleText(node:ReactNode):string {return Children.toArray(node).map(child=>{if(typeof child==='string'||typeof child==='number')return String(child);if(isValidElement<{message?:string;children?:ReactNode}>(child))return child.props.message??titleText(child.props.children);return '';}).join('');}
export function Modal({open,onClose,title,subtitle,children,footer,width='max-w-lg',className}:{open:boolean;onClose:()=>void;title:ReactNode;subtitle?:ReactNode;children:ReactNode;footer?:ReactNode;width?:string;className?:string}) {
 return <OpsModal open={open} onClose={onClose} title={titleText(title)||'Healthcare Suite'} subtitle={subtitle?titleText(subtitle):undefined} size="lg" className={`hc-modal ${width} ${className??''}`} footer={footer}><div className="px-4 py-3">{children}</div></OpsModal>;
}
