import {render,screen,waitFor} from '@testing-library/react';
import {it,expect} from 'vitest';
import {ReferenceSchoolModule} from './test-support/module';
import {createFakeBackend,fakeHost,FakeHttpError} from './test-support/fake-host.test-support';
import {schoolPageAvailable} from './policy';
it.each(['librarian','accountant'])('%s settings do not read forbidden academic collections',async role=>{
 const backend=createFakeBackend({intercept:request=>['/classes','/subjects','/teachers','/students'].includes(request.path)?new FakeHttpError(403,'Forbidden academic collection'):undefined});
 render(<ReferenceSchoolModule path="/settings" host={fakeHost(backend,{roles:[role]})}/>);await screen.findByRole('textbox',{name:'Full name'});await waitFor(()=>expect(backend.pending).toBe(0));expect(backend.requests.filter(request=>/^\/api\/(classes|subjects|teachers|students)$/.test(request.path))).toEqual([]);
});
it('narrows source menu membership to the existing service while keeping domain pages',()=>{expect(schoolPageAvailable('librarian','/students')).toBe(false);expect(schoolPageAvailable('accountant','/notices')).toBe(false);expect(schoolPageAvailable('librarian','/library')).toBe(true);expect(schoolPageAvailable('accountant','/reports')).toBe(true);});
