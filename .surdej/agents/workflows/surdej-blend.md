---
name: surdej-blend
description: Safely blend a super prompt into the project using a step-wise plan, documentation updates, and user consent gates.
---

## Objective
To safely and systematically integrate a new "super prompt" or feature specification into the current environment by first analyzing its impact, building an actionable plan, and proceeding step-by-step with explicit user consent.

## Instructions for the Agent

1. **Analyze the Super Prompt**
   - Read the provided super prompt (reference file) that the user supplies or points to.
   - Analyze the consequences of blending this super prompt into the current environment. 
   - Identify potential architectural impacts, dependencies, and risks.

2. **Create the Implementation Plan**
   - Generate a detailed, step-wise implementation plan based on the analysis.
   - Save this plan as a markdown file in the `plans/` directory (e.g., `plans/blend-[topic].md`). Ensure the `plans/` directory is created if it does not exist.
   - Format the steps as a checklist with actionable, atomic `[ ]` to-dos.

3. **Consent Gate: Plan Approval**
   - Present the analysis and the plan to the user.
   - **Crucial:** You must pause your execution entirely and explicitly ask the user for consent to proceed with the first implementation step. 

4. **Step-wise Implementation & Tracking**
   - Execute one major step of the plan at a time.
   - After completing a step, update the plan in the `plans/` directory by checking off the relevant item (`[x]`).
   - **Consent Gate:** Stop and ask the user for consent before proceeding to the next major step. Repeat this process until all steps in the plan are complete.

5. **Document the Implementation**
   - Once all steps are completed, document what was implemented.
   - Write or update appropriate files in the `docs/` directory detailing the architecture, components, and intent of the new blend. Ensure the `docs/` directory is created if it does not exist.
   - Present a final summary of changes to the user.
