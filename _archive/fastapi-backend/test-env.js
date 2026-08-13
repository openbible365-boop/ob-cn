import { loadEnv } from 'vite';
const env = loadEnv('development', '../', ['VITE_', 'GOOGLE_']);
console.log("Vite parsed ENV:", env);
