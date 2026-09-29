// Minimal equivalents of the source Nest HTTP exceptions; no web framework or fabricated identity.
export class HttpException extends Error {
  constructor(value,status){super(typeof value==='string'?value:value.message);this.status=status;this.response=typeof value==='string'?{statusCode:status,message:value}:value;}
}
export class BadRequestException extends HttpException {constructor(value){super(value,400);}}
export class NotFoundException extends HttpException {constructor(value){super(value,404);}}
export class Logger {log() {}}
