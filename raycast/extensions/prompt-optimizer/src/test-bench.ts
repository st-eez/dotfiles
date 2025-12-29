#!/usr/bin/env npx ts-node
import "./setup-test";
import { main } from "./bench";

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
