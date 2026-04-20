import "server-only";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

// Ensure Neon uses WebSockets in Node.js runtime.
neonConfig.webSocketConstructor = ws;
