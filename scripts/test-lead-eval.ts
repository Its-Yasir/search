import dotenv from "dotenv";
dotenv.config();

import { evaluateSinglePostLead } from "../lib/ai/leadEvaluator";
import { UnifiedPost } from "../lib/search/types";

async function testLeadEvaluation() {
  console.log("=== Testing Lead Evaluation with AI ===");

  const icp = {
    name: "ColdReach AI",
    title: "B2B Outbound Cold Email Automation",
    description: "Automated AI cold outreach software that writes hyper-personalized emails and manages deliverability to generate booked meetings for B2B startups.",
  };

  const specificIcp = {
    name: "Early-Stage B2B SaaS Founders",
    description: "Founders of pre-Series A B2B software companies who have no sales team and struggle with outbound sales and spam filters.",
    whatToSearch: "Look for founders asking how to book meetings, complaining about emails going to spam, or asking for cold email tool recommendations.",
  };

  const qualifiedPost: UnifiedPost = {
    id: "p1",
    platform: "reddit",
    title: "Need recommendations: What cold email tool are you using for B2B outbound?",
    text: "We just launched our B2B SaaS and our emails are hitting the spam folder with Apollo. Need a tool with warmups, AI personalization, and good deliverability. Any advice?",
    url: "https://reddit.com/r/saas/1",
    queryUsed: "cold email tool recommendation",
    author: { name: "saas_founder_42" },
    score: 0.85,
  };

  const rejectedPost: UnifiedPost = {
    id: "p2",
    platform: "x",
    text: "10 best pizza places to visit in Brooklyn this weekend. The margherita slice at Lucali is unbeatable!",
    url: "https://x.com/pizza1",
    queryUsed: "cold email tool recommendation",
    author: { name: "foodie" },
    score: 0.45,
  };

  console.log("\n1. Evaluating Qualified Post...");
  const eval1 = await evaluateSinglePostLead(qualifiedPost, icp, specificIcp);
  console.log("Result 1:", eval1);

  console.log("\n2. Evaluating Irrelevant Post...");
  const eval2 = await evaluateSinglePostLead(rejectedPost, icp, specificIcp);
  console.log("Result 2:", eval2);

  if (eval1.isLead && !eval2.isLead) {
    console.log("\n🎉 AI Lead Evaluation Test PASSED successfully!");
  } else {
    console.warn("\n⚠️ Check responses above for unexpected classification.");
  }
}

testLeadEvaluation();
