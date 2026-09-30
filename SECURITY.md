# Security

Do not open a public issue containing API keys or private repository contents.

This action sends selected PR data to TypeSafe AI. Repository files are opt-in.
Run it using trusted configuration from the immutable PR base commit. It never
checks out or executes PR code. Use `pull_request_target` only as shown in the
README: never combine this action with a checkout or execution of the PR head.

Prompt injection can still affect semantic classification. Configuration is the
only source of classification instructions, and output can only select allowed
labels, but these controls do not guarantee that labels are correct. Use dry-run
first and avoid labels that trigger deployment, payments, access, or other
sensitive automation. API errors produce no label writes.

File exclusions reduce accidental disclosure; they are not a secret scanner.
Review explicit repository include patterns before enabling repo-file context.
