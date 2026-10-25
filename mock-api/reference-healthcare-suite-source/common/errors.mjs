// Adapted from healthcare-suite/backend/src/common/errors.ts. Reproduce with ../reference-healthcare-suite-import.mjs.
import { BadRequestException } from '../runtime.mjs';
export class ValidationFailed extends BadRequestException {
    constructor(fields, message = 'Some fields need attention'){
        super({
            statusCode: 400,
            message,
            fields
        });
    }
}
