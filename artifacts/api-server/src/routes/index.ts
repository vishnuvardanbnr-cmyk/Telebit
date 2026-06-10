import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import depositsRouter from "./deposits";
import withdrawalsRouter from "./withdrawals";
import p2pRouter from "./p2p";
import settingsRouter from "./settings";
import adminRouter from "./admin";
import shopRouter from "./shop";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(depositsRouter);
router.use(withdrawalsRouter);
router.use(p2pRouter);
router.use(settingsRouter);
router.use(adminRouter);
router.use(shopRouter);

export default router;
