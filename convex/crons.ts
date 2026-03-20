import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "poll google form responses",
  { minutes: 5 },
  internal.processFormResponses.pollAll
);

export default crons;
