/** Typed transport failure; never exposes an exception message or response body. */
export class RequestFailure extends Error {
 constructor(public status?:number,public reference?:string){super('Request failed');this.name='RequestFailure';}
}
