import { Spring } from "framer-motion";

/**
 * Shared framer-motion spring configurations that match the CSS
 * --ease-spring tokens used across the application.
 */

export const springConfig: Spring = {
  type: "spring",
  stiffness: 300,
  damping: 30,
};

export const bouncySpringConfig: Spring = {
  type: "spring",
  stiffness: 400,
  damping: 25,
};
