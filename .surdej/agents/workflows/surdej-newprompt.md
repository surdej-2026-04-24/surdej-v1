---
name: surdej-newprompt
description: Interactively create a new AI agent workflow/prompt for the Surdej platform
---

## Objective
Act as an interviewer and assistant to help the user design, structure, and implement a new AI agent prompt/workflow for the Surdej environment. 

## Instructions for the Agent

1. **Interview the User**
   - Start by asking the user: "What is the primary goal of the new workflow you want to create?"
   - Ask follow-up questions to uncover details:
     - Are there specific shell commands or scripts this workflow should execute?
     - What files or context should the agent read before acting?
     - What are the success criteria or desired side-effects?
     - Does it need a specific name (remember to prefix with `surdej-`)?

2. **Draft the Workflow**
   - Based on the user's answers, define a systematic, step-by-step markdown workflow.
   - Use the standard format incorporating the YAML frontmatter (`name`, `description`).
   - If steps are strictly safe shell executions, you may optionally annotate them with `// turbo` above the markdown bash block.
   - Show the drafted workflow to the user for approval.

3. **File Creation (Execution Phase)**
   - Once approved, you **must** write the workflow artifacts to their canonical locations.
   - **Crucial Rule:** Every new workflow must be registered in three locations using the `surdej-` prefix:
     1. The canonical core logic file in `.surdej/agents/workflows/surdej-[name].md`
     2. The GitHub Copilot slash command proxy in `.github/prompts/surdej-[name].prompt.md`
     3. The legacy/fallback proxy in `.agent/workflows/surdej-[name].md`

4. **Implementation Examples**
   - *Canonical Logic* (`.surdej/agents/workflows/surdej-[name].md`):
     Should contain the actual frontmatter and step-by-step logic.
   - *GitHub Proxy* (`.github/prompts/surdej-[name].prompt.md`):
     ```markdown
     ---
     name: surdej-[name]
     description: [description]
     ---
     Please execute the workflow defined in `.surdej/agents/workflows/surdej-[name].md`. 
     Read that file and systematically execute each step.
     ```
   - *Legacy Proxy* (`.agent/workflows/surdej-[name].md`):
     ```markdown
     ---
     description: [description]
     ---
     > **📘 Canonical Source**: `../../.surdej/agents/workflows/surdej-[name].md`
     >
     > This workflow has been moved. Please refer to `.surdej/agents/workflows/surdej-[name].md`.
     ```

5. **Completion**
   - Inform the user that the new `surdej-` workflow has been registered and is now available across VS Code Copilot and CLI-based tools.
