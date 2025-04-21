// Type definitions for third-party modules

declare module 'passport-github2' {
  import { Strategy as PassportStrategy } from 'passport';
  import { Request } from 'express';

  export interface Profile {
    id: string;
    displayName: string;
    username?: string;
    profileUrl?: string;
    emails?: Array<{ value: string; primary?: boolean; verified?: boolean }>;
    photos?: Array<{ value: string }>;
    provider: string;
    _json: any;
    _raw: string;
  }

  export interface StrategyOptions {
    clientID: string;
    clientSecret: string;
    callbackURL: string;
    scope?: string | string[];
    userAgent?: string;
    state?: boolean;
    passReqToCallback?: boolean;
  }

  export type VerifyCallback = (err?: Error | null, user?: any, info?: any) => void;

  export type VerifyFunction = 
    (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => void;

  export type VerifyFunctionWithRequest = 
    (req: Request, accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => void;

  export class Strategy extends PassportStrategy {
    constructor(options: StrategyOptions, verify: VerifyFunction | VerifyFunctionWithRequest);
    name: string;
    authenticate(req: Request, options?: any): void;
  }
}