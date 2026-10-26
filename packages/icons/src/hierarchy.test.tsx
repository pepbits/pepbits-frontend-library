// @vitest-environment jsdom
import React from 'react';
import {render} from '@testing-library/react';
import {expect,test} from 'vitest';
import {ChevronsDownUp,ChevronsUpDown,Folder,FolderOpen} from './index';
test.each([ChevronsDownUp,ChevronsUpDown,Folder,FolderOpen])('hierarchy primitive renders through the public barrel',Icon=>{const {container}=render(<Icon size={15} aria-hidden/>);expect(container.querySelector('svg')?.getAttribute('width')).toBe('15');});
