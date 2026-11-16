import { Router } from 'express';
import * as ctrl from '../controllers/productos.controller.js';

const router = Router();
router.get('/', ctrl.listar);

export default router;