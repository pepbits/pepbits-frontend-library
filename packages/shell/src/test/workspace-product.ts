import {product,catalog} from './host';
import type {ProductDefinition} from '../products';
export const workspaceProduct: ProductDefinition={...product,modules:{...product.modules,
 'operations-review':{...catalog.modules.operations!,id:'operations-review',navigation:[{id:'main',label:'Main',items:[{id:'home',label:'Overview',pageId:'operations-dashboard'},{id:'items',label:'Items',pageId:'items'}]}]},
 'operations-edit':{...catalog.modules.operations!,id:'operations-edit',navigation:[{id:'main',label:'Main',items:[{id:'home',label:'Overview',pageId:'operations-dashboard'},{id:'items',label:'Items',pageId:'items'}]}]}
}};
