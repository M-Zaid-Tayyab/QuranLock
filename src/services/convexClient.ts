import { ConvexHttpClient } from "convex/browser";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

export const convexClient = convexUrl ? new ConvexHttpClient(convexUrl) : null;
