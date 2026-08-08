# Coding Style Rules

- Write ESM TypeScript with two-space indentation, double quotes, and no semicolons.
- Prefer small pure helpers, immutable updates, and clear names over dense control flow or abbreviated variables.
- Validate untrusted configuration and ACP boundary data before use. Avoid `any`, broad casts, and silently ignored errors.
- Keep provider-specific behavior isolated behind existing provider and ACP seams; do not leak it into generic task or UI code.
- Preserve user-facing text as concise, actionable status. Do not surface raw protocol metadata unless it is needed to diagnose an error.
