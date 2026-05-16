import { Router } from 'express';
import { register, login } from '../controller/authcontroller.js';

const userRoute = Router();

// User authentication routes
userRoute.post('/register', register);
userRoute.post('/signup', register);
userRoute.post('/login', login);

export default userRoute;
