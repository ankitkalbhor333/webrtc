import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from "dotenv";
import connecttosocket from './src/controller/socketmanager.js';
import userRoutes from './src/routes/userroutes.js';
import { getAllowedOrigins } from './src/config/cors.js';
dotenv.config();

const app = express();
const allowedOrigins = getAllowedOrigins();

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));

// Routes
app.use('/api/user', userRoutes);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/home', (req, res) => {
  res.send('Hello !');
});
const httpServer = createServer(app);

const io =connecttosocket(httpServer)
;
const start = async () => {
  await mongoose.connect(process.env.MONGO_URL);
  console.log("Connected to MongoDB");

  httpServer.listen(process.env.PORT || 3000, () => {
    console.log('Server running...');
  });
};

start();