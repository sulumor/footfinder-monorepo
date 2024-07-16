import express from "express";
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from "cors";
import cookieParser from "cookie-parser";
import router from "./routers/index.router.js";
import errorMiddleware from "./middlewares/error.middleware.js";
import createDoc from "./helpers/swagger.doc.js";

const corsOptions = {
  origin: process.env.ORIGIN,
  credentials: true,
};

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

createDoc(app);

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.static(__dirname + '/public'));
app.use("/api", router);
app.use(errorMiddleware);

export default app;
