export const validate = (schemas) => {
    return (req, res, next) => {
        const checks = [
            { schema: schemas.body, payload: req.body, key: "body" },
            { schema: schemas.params, payload: req.params, key: "params" },
            { schema: schemas.query, payload: req.query, key: "query" }
        ];
        for (const check of checks) {
            if (!check.schema) {
                continue;
            }
            const parsed = check.schema.safeParse(check.payload);
            if (!parsed.success) {
                res.status(400).json({
                    error: "Validation error",
                    issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }))
                });
                return;
            }
            if (check.key === "body") {
                req.body = parsed.data;
            }
            else if (check.key === "params") {
                req.params = parsed.data;
            }
            else {
                req.query = parsed.data;
            }
        }
        next();
    };
};
