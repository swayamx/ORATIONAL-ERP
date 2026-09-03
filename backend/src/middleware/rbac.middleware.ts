import { Request, Response, NextFunction } from 'express';

export function requireRole(allowedRoles: Array<'ADMIN' | 'OPERATIONS' | 'SALES'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthenticated'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Role '${req.user.role}' is not authorized to perform this action.`
      });
    }

    return next();
  };
}
