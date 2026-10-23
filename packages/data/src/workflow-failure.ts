/** Structured workflow rejection; fields and references remain available to recovery UI. */
export class WorkflowRequestFailure extends Error {
 constructor(public status:number,public fieldErrors:Record<string,string>={},public reference?:string){super('Workflow request failed');}
}
