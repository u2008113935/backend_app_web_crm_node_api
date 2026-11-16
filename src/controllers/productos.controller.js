import { asyncHandler } from '../utils/asyncHandler.js';
import * as productosRepo from '../repositories/productos.repository.js';

export const listar = asyncHandler(async (req, res) => {
  res.json(await productosRepo.listarActivos());
});