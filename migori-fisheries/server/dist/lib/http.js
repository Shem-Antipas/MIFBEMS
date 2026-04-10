export class HttpError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}
export const asyncHandler = (handler) => {
    return (req, res, next) => {
        handler(req, res, next).catch(next);
    };
};
