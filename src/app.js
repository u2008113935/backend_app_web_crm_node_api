import express from 'express';
import cors from 'cors';
import productosRoutes from './routes/productos.routes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/salud', (req, res) => res.json({ ok: true }));
app.use('/api/productos', productosRoutes);

app.use((req, res) => res.status(404).json({ mensaje: 'Ruta no encontrada' }));
app.use(errorHandler);

export default app;