import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import depositsRouter from "./deposits";
import withdrawalsRouter from "./withdrawals";
import p2pRouter from "./p2p";
import settingsRouter from "./settings";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(depositsRouter);
router.use(withdrawalsRouter);
router.use(p2pRouter);
router.use(settingsRouter);
router.use(adminRouter);

export default router;
