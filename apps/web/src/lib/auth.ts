import NextAuth, { CredentialsSignin } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import { authApi } from './api';
import {
  checkRateLimit,
  recordFailedAttempt,
  clearRateLimit,
} from './rate-limiter';

// Custom error for rate limiting
class RateLimitError extends CredentialsSignin {
  code = 'rate_limited';
}

class InvalidCredentialsError extends CredentialsSignin {
  code = 'invalid_credentials';
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;

        // Check rate limit before attempting login
        const rateLimitCheck = checkRateLimit(email);
        if (!rateLimitCheck.allowed) {
          throw new RateLimitError(rateLimitCheck.message);
        }

        const response = await authApi.login({
          email,
          password: credentials.password as string,
        });

        if (!response.success || !response.data) {
          // Record failed attempt
          const failResult = recordFailedAttempt(email);

          if (!failResult.allowed) {
            throw new RateLimitError(failResult.message);
          }

          if (failResult.message) {
            // Warning about remaining attempts
            throw new InvalidCredentialsError(failResult.message);
          }

          return null;
        }

        // Clear rate limit on successful login
        clearRateLimit(email);

        return {
          id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.name,
          image: response.data.user.image,
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
        };
      },
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // For OAuth providers, sync with our backend
      if (account?.provider && account.provider !== 'credentials') {
        try {
          const response = await authApi.oauth({
            email: user.email!,
            name: user.name || undefined,
            image: user.image || undefined,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
          });

          if (response.success && response.data) {
            // Store the tokens and user data for later use
            (user as any).id = response.data.user.id;
            (user as any).accessToken = response.data.accessToken;
            (user as any).refreshToken = response.data.refreshToken;
            // Use the image from our backend (in case user has custom avatar)
            // Falls back to OAuth provider image if not set in backend
            (user as any).image = response.data.user.image || user.image;
          }
        } catch (error) {
          console.error('OAuth sync error:', error);
          // Allow sign in even if sync fails
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session: updateSession }) {
      // Initial sign in
      if (user) {
        token.id = (user as any).id || user.id;
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        token.image = user.image;
      }

      // Handle session update (e.g., after avatar change)
      if (trigger === 'update' && updateSession?.image !== undefined) {
        token.image = updateSession.image;
      }

      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.image = token.image as string | null;
        (session as any).accessToken = token.accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
  },
});

// Type augmentation for next-auth
declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
  }
}
