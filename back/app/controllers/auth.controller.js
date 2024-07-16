import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import ApiError from "../errors/api.error.js";
import CoreController from "./core.controller.js";
import AuthDatamapper from "../datamapper/auth.datamapper.js";
import PlayerDatamapper from "../datamapper/player.datamapper.js";
import ScoutDatamapper from "../datamapper/scout.datamapper.js";
import { createAccessToken, createForgotPasswordToken, createRefreshToken } from "../helpers/jwt.function.js";
import sendEmail from "../helpers/nodemailer.funtion.js";

/**
 * Authentication controller
 */
export default class AuthController extends CoreController {
  static datamapper = AuthDatamapper;

  /**
   * Method to connect a user
   * @param { Express.Request.body } body Object with user's information
   * @param { Express.Response } res
   * @param { Express.NextFunction } next
   * @returns { RegisterResponse } The access token
   */
  static async login({ body }, res, next) {
    const errorMessage = "Authentification failed";
    const errorInfos = { httpStatus: 401 };

    const [user] = await this.datamapper.findAll({ where: { email: body.email } });
    if (!user) return next(new ApiError(errorMessage, errorInfos));

    const isPasswordCorrect = await bcrypt.compare(body.password, user.password);
    if (!isPasswordCorrect) return next(new ApiError(errorMessage, errorInfos));

    const [data] = user.role
      ? await PlayerDatamapper.findAll({ where: { email: body.email } })
      : await ScoutDatamapper.findAll({ where: { email: body.email } });
    if (!data) return next(new ApiError(errorMessage, errorInfos));

    return res.status(200).json({
      accessToken: createAccessToken(data),
      refreshToken: createRefreshToken(data),
    });
  }

  /**
   * Method to send user information from token
   * @param { Express.Request.user } user Object with user's information
   * @param { Express.Response } res
   * @returns { UserToken } User's information from token
  */
  static getUser({ user }, res) {
    return res.status(200).json(user);
  }

  /**
   * Method to create a new access token with a refresh token
   * @param { Express.Request.cookies } cookies The refresh cookie
   * @param { Express.Response } res
   * @param { Express.NextFunction } next
   * @returns { RegisterResponse } The access token
   */
  // eslint-disable-next-line consistent-return
  static refreshToken({ body }, res, next) {
    const { refreshToken } = body;
    if (!refreshToken) return next(new ApiError("Null token", { httpStatus: 401 }));
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
      if (err) return next(new ApiError(err.message, { httpStatus: 403 }));
      return res.status(200).json({ accessToken: createAccessToken(user) });
    });
  }

  /**
   * Method to register a new user.
   * @param { Express.Request.body } body Object with user's information
   * @param { Express.Response } res
   * @param { Express.NextFunction } next
   * @returns { RegisterResponse } The access token
   */
  static async register({ body }, res, next) {
    const [existsUser] = await this.datamapper.findAll({ where: { email: body.email } });
    if (existsUser) return next(new ApiError("User already exists", { httpStatus: 400 }));

    const { confirmedPassword: dontKeep, ...data } = body;
    data.password = await bcrypt.hash(data.password, Number.parseInt(process.env.BCRYPT_SALT, 10));

    const user = await this.datamapper.insertSQL(data);

    const person = data.role
      ? await PlayerDatamapper.insertSQL(user)
      : await ScoutDatamapper.insertSQL(user);

    return res.status(201).json({
      accessToken: createAccessToken(user),
      refreshToken: createRefreshToken(person),
    });
  }

  static async forgotPassword({ body }, res, next) {
    const { email } = body;
    const [existsUser] = await this.datamapper.findAll({ where: { email } });
    if (!existsUser) return next(new ApiError("Utilisateur n'existe pas", { httpStatus: 401 }));

    const token = createForgotPasswordToken(existsUser);
    const response = await sendEmail({ email, id: existsUser.id, token });

    if (!response) return next(new ApiError("Email pas envoyé", { httpStatus: 503 }));
    return res.status(204).end();
  }

  static async resetPassword({ body, user }, res, next) {
    const { id, password } = body;
    const [existsUser] = await this.datamapper.findAll({ where: { id } });

    if (!existsUser) return next(new ApiError("Utilisateur n'existe pas", { httpStatus: 401 }));
    if (existsUser.id !== user.id) return next(new ApiError("Utilisateur n'existe pas", { httpStatus: 401 }));

    const newPassword = await bcrypt.hash(password, Number.parseInt(process.env.BCRYPT_SALT, 10));

    const dataToUpdated = { id, password: newPassword };
    const [dataUpdated] = existsUser.role
      ? await PlayerDatamapper.updateSQL(dataToUpdated)
      : await ScoutDatamapper.updateSQL(dataToUpdated);

    if (!dataUpdated) return next(new ApiError("Données pas mise à jour", { httpStatus: 500 }));
    return res.status(204).end();
  }
}
