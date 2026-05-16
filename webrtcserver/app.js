import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from "dotenv";
import connecttosocket from './src/controller/socketmanager.js';
import userRoutes from './src/routes/userroutes.js';
dotenv.config();

const app = express();

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json({limit: '50mb'}));
app.use(express.urlencoded({limit: '50mb', extended: true}));

// Routes
app.use('/api/user', userRoutes);

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