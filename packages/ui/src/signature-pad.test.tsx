import React,{useState} from "react";
import {render,screen,fireEvent} from "./test/render";
import userEvent from "@testing-library/user-event";
import {afterEach,expect,test,vi} from "vitest";
import {SignaturePad} from "./signature-pad";

const original=HTMLCanvasElement.prototype.getContext,originalData=HTMLCanvasElement.prototype.toDataURL;
afterEach(()=>{vi.unstubAllGlobals();HTMLCanvasElement.prototype.getContext=original;HTMLCanvasElement.prototype.toDataURL=originalData;});
function fakeContext(){const ctx={setTransform:vi.fn(),beginPath:vi.fn(),moveTo:vi.fn(),lineTo:vi.fn(),stroke:vi.fn(),clearRect:vi.fn(),drawImage:vi.fn(),lineCap:'',lineJoin:'',strokeStyle:'',lineWidth:0};HTMLCanvasElement.prototype.getContext=(()=>ctx) as unknown as typeof original;HTMLCanvasElement.prototype.toDataURL=()=> 'data:image/png;base64,SIGNED';return ctx;}

test('drawing reports a PNG data URL and clearing empties the controlled value',async()=>{
 const ctx=fakeContext();const changes:(string|null)[]=[];
 function Host(){const [value,setValue]=useState<string|null>(null);return <SignaturePad label="Signature" required value={value} onChange={next=>{changes.push(next);setValue(next);}}/>;}
 render(<Host/>);
 const area=screen.getByRole('img',{name:/signature area/i});
 expect(screen.getByText('Sign here')).toBeInTheDocument();
 fireEvent.pointerDown(area,{clientX:4,clientY:4,pointerId:1});fireEvent.pointerMove(area,{clientX:20,clientY:12,pointerId:1});fireEvent.pointerUp(area,{pointerId:1});
 expect(ctx.stroke).toHaveBeenCalled();expect(changes).toEqual(['data:image/png;base64,SIGNED']);
 expect(screen.queryByText('Sign here')).toBeNull();
 await userEvent.click(screen.getByRole('button',{name:'Clear signature'}));
 expect(changes.at(-1)).toBeNull();expect(screen.getByText('Sign here')).toBeInTheDocument();
});

test('errors describe the area, disabled pads ignore input and missing canvas support stays usable',async()=>{
 HTMLCanvasElement.prototype.getContext=(()=>null) as unknown as typeof original;const onChange=vi.fn();
 const {rerender}=render(<SignaturePad label="Signature" error="Ask the patient to sign" value={null} onChange={onChange}/>);
 const area=screen.getByRole('img',{name:/signature area/i});
 expect(area).toHaveAttribute('data-invalid');expect(area).toHaveAccessibleDescription('Ask the patient to sign');
 fireEvent.pointerDown(area,{clientX:1,clientY:1,pointerId:1});fireEvent.pointerUp(area,{pointerId:1});
 expect(onChange).not.toHaveBeenCalled();
 rerender(<SignaturePad label="Signature" disabled value={null} onChange={onChange}/>);
 fireEvent.pointerDown(screen.getByRole('img',{name:/signature area/i}),{clientX:1,clientY:1,pointerId:1});fireEvent.pointerUp(screen.getByRole('img',{name:/signature area/i}),{pointerId:1});
 expect(onChange).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Clear signature'})).toBeDisabled();
});

test('the image role carries no disallowed state attributes and names a required pad', () => {
 fakeContext();
 render(<SignaturePad label="Signature" required error="Ask the patient to sign" value={null} onChange={()=>{}}/>);
 const area=screen.getByRole('img',{name:/signature area.*\(required\)/i});
 for(const attribute of ['aria-invalid','aria-required','aria-disabled'])expect(area).not.toHaveAttribute(attribute);
});


test('host updates restore and clear the bitmap, and obsolete image loads cannot restore cleared ink',()=>{
 const ctx=fakeContext(), images:{onload:(()=>void)|null;src:string}[]=[];
 vi.stubGlobal('Image',class {onload:(()=>void)|null=null;src='';constructor(){images.push(this);}});
 const onChange=vi.fn();
 const {rerender}=render(<SignaturePad value={null} onChange={onChange}/>);
 rerender(<SignaturePad value="data:image/png;base64,RESTORED" onChange={onChange}/>);
 expect(images[0]?.src).toBe('data:image/png;base64,RESTORED');
 images[0]?.onload?.();
 expect(ctx.drawImage).toHaveBeenCalledTimes(1);
 expect(screen.queryByText('Sign here')).toBeNull();
 rerender(<SignaturePad value="data:image/png;base64,OBSOLETE" onChange={onChange}/>);
 const clears=ctx.clearRect.mock.calls.length;
 rerender(<SignaturePad value={null} onChange={onChange}/>);
 expect(ctx.clearRect.mock.calls.length).toBeGreaterThan(clears);
 images[1]?.onload?.();
 expect(ctx.drawImage).toHaveBeenCalledTimes(1);
 expect(screen.getByText('Sign here')).toBeInTheDocument();
 expect(onChange).not.toHaveBeenCalled();
});
