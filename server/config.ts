import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Joi from 'joi';

// Define __dirname for ES module scope
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, `../.env`);
console.log('Environment:', envPath);
dotenv.config({
    path: path.resolve(envPath ? envPath : path.join(__dirname, '../.env'))
});

const envSchema = Joi.object().keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.string().required().default('4000'),
    GITHUB_CLIENT_ID: Joi.string().required(),
    GITHUB_CLIENT_SECRET: Joi.string().required(),
    SESSION_SECRET: Joi.string().required(),
    MONGODB_URI: Joi.string().required(),
    REDIS_HOST: Joi.string().required(),
    REDIS_PORT: Joi.string().required(),
    REDIS_PASSWORD: Joi.string().required(),
    REDIS_URL: Joi.string().required()
});



const { value: validatedEnv, error } = envSchema
    .prefs({ errors: { label: 'key' } })
    .validate(process.env, { abortEarly: false, stripUnknown: true });

if (error) {
    throw new Error(
        `Environment variable validation error: \n${error.details
            .map((detail) => detail.message)
            .join('\n')}`
    );
}

const config = {
    node_env: validatedEnv.NODE_ENV,
    auth: {
        github: {
            clientID: validatedEnv.GITHUB_CLIENT_ID,
            clientSecret: validatedEnv.GITHUB_CLIENT_SECRET
        },
    },
    server: {
        port: validatedEnv.PORT,
    },
    db: {
        uri: validatedEnv.MONGODB_URI
    },
    session: {
        secret: validatedEnv.SESSION_SECRET
    },
    redis: {
        host: validatedEnv.REDIS_HOST || '127.0.0.1', // Localhost
        port: validatedEnv.REDIS_PORT || 6379,        // Default port
        password: validatedEnv.REDIS_PASSWORD || undefined, // No password for now
        url: validatedEnv.REDIS_URL
    }
} as const;

export default config;
