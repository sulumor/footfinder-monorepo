import jwt from "jsonwebtoken";
import ApiError from "../errors/api.error.js";
import AuthDatamapper from "../datamapper/auth.datamapper.js";

// eslint-disable-next-line consistent-return
function authenticateToken(req, _, next) {
  const authHeader = req.headers.authorization;// Bearer TOKEN
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return next(new ApiError("Token non disponible", { httpStatus: 401 }));
  // eslint-disable-next-line consistent-return
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (error, user) => {
    if (error) return next(new ApiError(error.message, { httpStatus: 403 }));
    const [userExits] = await AuthDatamapper.findAll({
      where:
      { id: user.id, firstname: user.firstname, role: user.role },
    });
    if (!userExits) return next(new ApiError("Accès interdit", { httpStatus: 403 }));
    req.user = user;
    next();
  });
}

// eslint-disable-next-line consistent-return
function authenticateResetPasswordToken(req, _, next) {
  const authHeader = req.headers.authorization;// Bearer TOKEN
  const token = authHeader && authHeader.split(" ")[1];
  if (token == null) return next(new ApiError("Token non disponible", { httpStatus: 401 }));
  // eslint-disable-next-line consistent-return
  jwt.verify(token, process.env.RESET_PASSWORD_TOKEN_SECRET, async (error, user) => {
    if (error) return next(new ApiError(error.message, { httpStatus: 403 }));
    const [userExits] = await AuthDatamapper.findAll({
      where:
      { id: user.id },
    });
    if (!userExits) return next(new ApiError("Accès interdit", { httpStatus: 403 }));
    req.user = user;
    next();
  });
}

function authorizationRoute({ originalUrl, user }, _, next) {
  const baseRoute = originalUrl.split("/")[2];
  // eslint-disable-next-line no-nested-ternary
  const role = user.role ? "player" : !user.role ? "scout" : null;
  if (baseRoute !== role) return next(new ApiError("Access Unauthorized", { httpStatus: 401 }));
  return next();
}

export { authenticateToken, authorizationRoute, authenticateResetPasswordToken };
