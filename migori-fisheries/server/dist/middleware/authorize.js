const defaultSubCountyResolver = (req) => {
    const fromBody = typeof req.body?.subCounty === "string" ? req.body.subCounty : undefined;
    const fromParams = typeof req.params?.subCounty === "string" ? req.params.subCounty : undefined;
    const fromQuery = typeof req.query?.subCounty === "string" ? req.query.subCounty : undefined;
    return fromBody ?? fromParams ?? fromQuery;
};
export const authorize = (allowedRoles, options) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: "Unauthorized" });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: "Forbidden: insufficient permissions" });
            return;
        }
        if (req.user.role === "FISHERIES_OFFICER") {
            const resourceSubCounty = options?.resolveSubCounty?.(req) ?? defaultSubCountyResolver(req);
            if (resourceSubCounty && req.user.subCounty && resourceSubCounty !== req.user.subCounty) {
                res.status(403).json({ error: "Forbidden: sub-county scope mismatch" });
                return;
            }
        }
        next();
    };
};
